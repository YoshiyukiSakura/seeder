import { NextRequest } from 'next/server'
import { runClaude } from '@/lib/claude'
import { createSSEError, encodeSSEEvent } from '@/lib/sse-types'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  let body: { answer?: string; projectPath?: string; sessionId?: string; planId?: string }
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

  const { answer, projectPath, sessionId, planId } = body

  if (!answer) {
    const errorEvent = createSSEError(
      'answer is required',
      'validation_error',
      { code: 'MISSING_ANSWER' }
    )
    return new Response(encodeSSEEvent(errorEvent), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  if (!sessionId) {
    const errorEvent = createSSEError(
      'sessionId is required for continuing conversation',
      'validation_error',
      { code: 'MISSING_SESSION_ID' }
    )
    return new Response(encodeSSEEvent(errorEvent), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const cwd = projectPath || process.cwd()

  // 保存用户回答到数据库，并清除 pendingQuestion（用户已回答）
  if (planId) {
    try {
      await prisma.conversation.create({
        data: {
          planId,
          role: 'user',
          content: answer
        }
      })
      // 清除 pendingQuestion，因为用户已经回答
      await prisma.plan.update({
        where: { id: planId },
        data: { pendingQuestion: null }
      })
    } catch (dbError) {
      console.error('Database error saving user answer:', dbError)
    }
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let assistantContent = ''

      try {
        // 使用 --resume <sessionId> 恢复特定会话
        for await (const event of runClaude({ prompt: answer, cwd, sessionId })) {
          // 收集助手消息内容
          if (event.type === 'text' && event.data?.content) {
            assistantContent += event.data.content
          }

          // 处理新的问题事件（Claude 可能会继续提问）
          if (event.type === 'question' && planId) {
            // 保存当前 assistant 消息
            if (assistantContent) {
              prisma.conversation.create({
                data: {
                  planId,
                  role: 'assistant',
                  content: assistantContent
                }
              }).catch(err => console.error('Failed to save assistant message early:', err))
              assistantContent = ''
            }

            // 保存新的 pendingQuestion
            if (event.data?.questions?.length > 0) {
              prisma.plan.update({
                where: { id: planId },
                data: { pendingQuestion: event.data }
              }).catch(err => console.error('Failed to save pendingQuestion:', err))
            }
          }

          // 在 result 事件中添加 planId
          if (event.type === 'result' && planId) {
            event.data.planId = planId
          }

          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        }

        // 保存助手消息到数据库
        if (planId && assistantContent) {
          try {
            await prisma.conversation.create({
              data: {
                planId,
                role: 'assistant',
                content: assistantContent
              }
            })
          } catch (dbError) {
            console.error('Database error saving assistant response:', dbError)
          }
        }
      } catch (error) {
        const errorEvent = createSSEError(
          String(error),
          'process_error',
          { recoverable: true, details: 'Failed to continue Claude CLI session' }
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
