import { NextRequest } from 'next/server'
import { runClaude } from '@/lib/claude'
import { createSSEError, encodeSSEEvent } from '@/lib/sse-types'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  let body: { prompt?: string; projectPath?: string; projectId?: string }
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

  const { prompt, projectPath, projectId } = body

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

      try {
        // 启动新会话（不传 sessionId）
        for await (const event of runClaude({ prompt, cwd })) {
          // 收集助手消息内容
          if (event.type === 'text' && event.data?.content) {
            assistantContent += event.data.content
          }

          // 捕获 sessionId
          if (event.type === 'result' && event.data?.sessionId) {
            claudeSessionId = event.data.sessionId

            // 在 result 事件中添加 planId
            if (planId) {
              event.data.planId = planId
            }
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
