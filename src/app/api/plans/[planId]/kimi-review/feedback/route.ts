import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runClaude } from '@/lib/claude'
import { createSSEError } from '@/lib/sse-types'
import { DbNull } from '@/generated/prisma/internal/prismaNamespace'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/plans/[planId]/kimi-review/feedback
 * 将 Kimi 评审反馈发送给 Claude
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const signal = request.signal

  let body: { feedback: string; reviewId?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const { feedback, reviewId } = body

  if (!feedback) {
    return new Response(JSON.stringify({ error: 'feedback is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // 获取 Plan 和 sessionId
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      project: {
        select: { localPath: true }
      }
    }
  })

  if (!plan) {
    return new Response(JSON.stringify({ error: 'Plan not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  if (!plan.sessionId) {
    return new Response(JSON.stringify({ error: 'Plan has no active Claude session' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const cwd = plan.project?.localPath || process.cwd()

  // 获取当前用户
  const user = await getCurrentUser(request)
  const userId = user?.id || null

  // 保存用户反馈到数据库（带 metadata 标记为 Kimi 反馈）
  try {
    await prisma.conversation.create({
      data: {
        planId,
        role: 'user',
        content: feedback,
        userId,
        metadata: {
          isKimiFeedback: true,
          reviewId: reviewId || null
        }
      }
    })
    // 清除 pendingQuestion（如果有）
    await prisma.plan.update({
      where: { id: planId },
      data: { pendingQuestion: DbNull }
    })
  } catch (dbError) {
    console.error('Database error saving feedback:', dbError)
  }

  // 创建 SSE 流发送给 Claude
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let assistantContent = ''
      let hasQuestion = false

      const sendEvent = (type: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`))
      }

      try {
        // 使用 --resume 恢复会话，发送反馈
        for await (const event of runClaude(
          { prompt: feedback, cwd, sessionId: plan.sessionId! },
          signal
        )) {
          if (signal.aborted) {
            controller.close()
            return
          }

          // 收集助手消息内容
          if (event.type === 'text' && event.data?.content) {
            assistantContent += event.data.content
          }

          // 处理问题事件
          if (event.type === 'question') {
            hasQuestion = true
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

            if (event.data?.questions?.length > 0) {
              prisma.plan.update({
                where: { id: planId },
                data: { pendingQuestion: event.data }
              }).catch(err => console.error('Failed to save pendingQuestion:', err))
            }
          }

          // 在 result 事件中添加 planId
          if (event.type === 'result') {
            event.data.planId = planId
            prisma.plan.update({
              where: { id: planId },
              data: { pendingQuestion: DbNull }
            }).catch(err => console.error('Failed to clear pendingQuestion:', err))
          }

          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        }

        // 添加 Plan Complete 标记
        if (!hasQuestion) {
          assistantContent += '\n\n---\n**Plan Complete**'
        }

        // 保存助手消息到数据库
        if (assistantContent) {
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
          { recoverable: true, details: 'Failed to send feedback to Claude' }
        )
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
