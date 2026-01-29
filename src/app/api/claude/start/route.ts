import { NextRequest } from 'next/server'
import { runClaude } from '@/lib/claude'
import { createSSEError, encodeSSEEvent } from '@/lib/sse-types'
import { prisma } from '@/lib/prisma'
import { DbNull } from '@/generated/prisma/internal/prismaNamespace'
import { pullLatest } from '@/lib/git-utils'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  // 获取请求的 abort signal
  const signal = request.signal

  let body: { prompt?: string; projectPath?: string; projectId?: string; imagePaths?: string[] }
  try {
    body = await request.json()
  } catch {
    const errorEvent = createSSEError(
      'Invalid JSON in request body',
      'validation_error'
    )
    return new Response(encodeSSEEvent(errorEvent), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const { prompt, projectPath, projectId, imagePaths } = body

  if (!prompt) {
    const errorEvent = createSSEError(
      'prompt is required',
      'validation_error',
      { code: 'MISSING_PROMPT' }
    )
    return new Response(encodeSSEEvent(errorEvent), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  // 确定工作目录：
  // - 有 projectPath: 使用指定的项目路径
  // - 有 projectId: 使用当前 Seeder 目录（正常项目）
  // - 都没有（Start Fresh）: 使用临时空目录，确保 Claude 没有项目上下文
  let cwd: string
  if (projectPath) {
    cwd = projectPath
  } else if (projectId) {
    cwd = process.cwd()
  } else {
    // Start Fresh 模式：创建临时空目录
    const { mkdtempSync } = await import('fs')
    const { join } = await import('path')
    const { tmpdir } = await import('os')
    cwd = mkdtempSync(join(tmpdir(), 'seedbed-fresh-'))
    console.log(`[fresh-mode] Using temp directory: ${cwd}`)
  }

  // 获取当前用户
  const user = await getCurrentUser(request)
  const userId = user?.id || null

  // 始终创建 Plan（支持 orphan plans），如果有 projectId 则关联
  let planId: string | null = null
  let validatedProjectId: string | null = null
  let gitSyncResult: { success: boolean; message?: string; error?: string; updated?: boolean } | null = null

  // 在 cwd 上执行 git pull（不依赖 project.localPath）
  // 跳过以下情况：
  // 1. 当前 dev server 目录（避免触发 Next.js Fast Refresh）
  // 2. Start Fresh 模式的临时目录（没有 git 仓库）
  const serverCwd = process.cwd()
  const isFreshMode = !projectPath && !projectId
  if (cwd !== serverCwd && !isFreshMode) {
    try {
      console.log(`[git-sync] Pulling latest at ${cwd}`)
      gitSyncResult = await pullLatest(cwd)
      if (gitSyncResult.success) {
        console.log(`[git-sync] Success: ${gitSyncResult.message}, updated: ${gitSyncResult.updated}`)
      } else {
        console.warn(`[git-sync] Failed: ${gitSyncResult.error}`)
      }
    } catch (err) {
      console.warn(`[git-sync] Error: ${err}`)
    }
  } else {
    const reason = isFreshMode ? 'fresh mode (temp directory)' : 'dev server directory'
    console.log(`[git-sync] Skipped for ${reason}: ${cwd}`)
  }

  // 如果有 projectId，验证项目存在
  if (projectId) {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId }
      })
      if (project) {
        validatedProjectId = projectId
      } else {
        console.warn(`Project not found: ${projectId}`)
      }
    } catch (dbError) {
      console.error('Database error validating project:', dbError)
    }
  }

  // 始终创建 Plan（projectId 可以是 null，支持 orphan plans）
  // 注意：即使数据库失败也生成 planId，确保前端功能正常工作
  let localPlanId: string | null = null
  try {
    const plan = await prisma.plan.create({
      data: {
        projectId: validatedProjectId,  // null 表示 orphan plan
        name: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
        description: prompt,
        status: 'DRAFT',
        creatorId: userId  // 保存创建者
      }
    })
    localPlanId = plan.id
    planId = plan.id

    // 保存用户消息
    await prisma.conversation.create({
      data: {
        planId,
        role: 'user',
        content: prompt,
        userId  // 保存发送者
      }
    })
  } catch (dbError) {
    console.error('Database error creating plan:', dbError)
    // 即使数据库失败，也生成一个本地 planId（不会保存到数据库）
    localPlanId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    planId = localPlanId
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let assistantContent = ''
      let claudeSessionId: string | null = null
      let hasQuestion = false  // 追踪是否有问题事件

      // 发送 git 同步结果事件（如果有）
      if (gitSyncResult) {
        const gitSyncEvent = {
          type: 'git_sync',
          data: gitSyncResult
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(gitSyncEvent)}\n\n`))
      }

      // 立即发送 planId，让前端可以显示 "Create Project" 按钮
      if (planId) {
        const planIdEvent = {
          type: 'plan_created',
          data: { planId }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(planIdEvent)}\n\n`))
      }

      try {
        // 启动新会话（不传 sessionId），传递 signal 以支持中断
        for await (const event of runClaude({ prompt, cwd, imagePaths }, signal)) {
          // 检查是否已中断
          if (signal.aborted) {
            controller.close()
            return
          }
          // 从 init 事件中捕获 sessionId 并立即保存到数据库
          // 这样即使 AskUserQuestion 时用户刷新页面，sessionId 也不会丢失
          if (event.type === 'init' && event.data?.sessionId && !claudeSessionId) {
            claudeSessionId = event.data.sessionId
            if (planId) {
              prisma.plan.update({
                where: { id: planId },
                data: { sessionId: claudeSessionId }
              }).catch(err => console.error('Failed to save sessionId early:', err))
            }
          }

          // 收集助手消息内容
          if (event.type === 'text' && event.data?.content) {
            assistantContent += event.data.content
          }

          // 当收到 question 事件时，立即保存已收集的 assistant 消息和问题数据到数据库
          // 避免用户刷新页面时丢失消息和问题弹窗
          if (event.type === 'question') {
            hasQuestion = true
            if (planId) {
              // 保存 assistant 消息
              if (assistantContent) {
                prisma.conversation.create({
                  data: {
                    planId,
                    role: 'assistant',
                    content: assistantContent
                  }
                }).catch(err => console.error('Failed to save assistant message early:', err))
                // 标记已保存，避免重复保存
                assistantContent = ''
              }

              // 保存 pendingQuestion 数据，刷新页面后可以恢复问题弹窗
              if (event.data?.questions?.length > 0) {
                prisma.plan.update({
                  where: { id: planId },
                  data: { pendingQuestion: event.data }
                }).catch(err => console.error('Failed to save pendingQuestion:', err))
              }
            }
          }

          // 也从 result 事件中捕获 sessionId（作为备份）
          if (event.type === 'result') {
            if (event.data?.sessionId && !claudeSessionId) {
              claudeSessionId = event.data.sessionId
            }
            // 在 result 事件中添加 planId
            if (planId) {
              event.data.planId = planId
              // 计划完成时清除 pendingQuestion，避免刷新页面后重复显示问题
              // 注意：只有真实的数据库 planId 才能更新，本地 planId（local-开头）跳过
              if (!planId.startsWith('local-')) {
                prisma.plan.update({
                  where: { id: planId },
                  data: { pendingQuestion: DbNull }
                }).catch(err => console.error('Failed to clear pendingQuestion on result:', err))
              }
            }
            // 注意：Plan Complete 标记在流处理完毕后添加，见下方
          }

          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        }

        // 在流处理完毕后，如果没有问题事件，添加 Plan Complete 标记
        if (!hasQuestion) {
          assistantContent += '\n\n---\n**Plan Complete**'
        }

        // 保存助手消息和 sessionId 到数据库
        if (planId && assistantContent) {
          try {
            // 只有真实的数据库 planId 才保存
            if (!planId.startsWith('local-')) {
              await prisma.conversation.create({
                data: {
                  planId,
                  role: 'assistant',
                  content: assistantContent
                }
              })

              // 更新 Plan 的 sessionId
              if (claudeSessionId) {
                await prisma.plan.update({
                  where: { id: planId },
                  data: { sessionId: claudeSessionId }
                })
              }
            }
          } catch (dbError) {
            console.error('Database error saving conversation:', dbError)
          }
        }
      } catch (error) {
        const errorEvent = createSSEError(
          String(error),
          'process_error',
          { recoverable: true, details: 'Failed to start Claude CLI process' }
        )
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
