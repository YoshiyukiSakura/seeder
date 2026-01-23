import { NextRequest } from 'next/server'
import { runClaude } from '@/lib/claude'
import { createSSEError, encodeSSEEvent } from '@/lib/sse-types'
import { prisma } from '@/lib/prisma'
import { pullLatest } from '@/lib/git-utils'

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

  const cwd = projectPath || process.cwd()

  // 如果有 projectId，创建 Plan 并保存对话
  let planId: string | null = null
  let gitSyncResult: { success: boolean; message?: string; error?: string; updated?: boolean } | null = null

  // 在 cwd 上执行 git pull（不依赖 project.localPath）
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

  if (projectId) {
    try {
      // 验证项目存在
      const project = await prisma.project.findUnique({
        where: { id: projectId }
      })
      if (project) {
        // 创建新的 Plan
        const plan = await prisma.plan.create({
          data: {
            projectId,
            name: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
            description: prompt,
            status: 'DRAFT'
          }
        })
        planId = plan.id

        // 保存用户消息
        await prisma.conversation.create({
          data: {
            planId,
            role: 'user',
            content: prompt
          }
        })
      }
    } catch (dbError) {
      console.error('Database error creating plan:', dbError)
      // 继续执行，只是不保存对话
    }
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let assistantContent = ''
      let claudeSessionId: string | null = null

      // 发送 git 同步结果事件（如果有）
      if (gitSyncResult) {
        const gitSyncEvent = {
          type: 'git_sync',
          data: gitSyncResult
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(gitSyncEvent)}\n\n`))
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
          if (event.type === 'question' && planId) {
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

          // 也从 result 事件中捕获 sessionId（作为备份）
          if (event.type === 'result') {
            if (event.data?.sessionId && !claudeSessionId) {
              claudeSessionId = event.data.sessionId
            }
            // 在 result 事件中添加 planId
            if (planId) {
              event.data.planId = planId
            }
            // 只添加 Plan Complete 标记，不添加 content（已在 text 事件中累积）
            // 避免数据库中保存重复内容
            assistantContent += '\n\n---\n**Plan Complete**'
          }

          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        }

        // 保存助手消息和 sessionId 到数据库
        if (planId && assistantContent) {
          try {
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
