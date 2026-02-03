import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runKimiReview, parseKimiReviewJson } from '@/lib/kimi-cli'

/**
 * POST /api/plans/[planId]/kimi-review
 * 触发 Kimi 评审计划，返回 SSE 流
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params

  // 1. 获取 Plan 和最后一条 assistant 消息
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      conversations: {
        where: { role: 'assistant' },
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      reviews: {
        where: { status: 'running' },
        take: 1
      },
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

  // 检查是否有正在运行的评审
  if (plan.reviews.length > 0) {
    return new Response(JSON.stringify({ error: 'A review is already running for this plan' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // 获取计划内容
  const lastAssistantMsg = plan.conversations[0]
  if (!lastAssistantMsg) {
    return new Response(JSON.stringify({ error: 'No plan content found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const planContent = lastAssistantMsg.content

  // 2. 计算当前评审轮次
  const previousReviewCount = await prisma.planReview.count({
    where: { planId }
  })
  const reviewRound = previousReviewCount + 1

  // 3. 生成 kimiSessionId
  const kimiSessionId = `kimi-review-${planId.slice(0, 8)}-round${reviewRound}`

  // 4. 创建 PlanReview 记录
  const review = await prisma.planReview.create({
    data: {
      planId,
      reviewerType: 'kimi-cli',
      kimiSessionId,
      reviewRound,
      status: 'running'
    }
  })

  // 5. 创建 SSE 流
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`))
      }

      try {
        // 发送初始化事件
        sendEvent('init', {
          reviewId: review.id,
          kimiSessionId,
          reviewRound
        })

        let accumulatedText = ''  // 累积 text 事件的内容

        // 运行 Kimi 评审
        for await (const event of runKimiReview({
          planContent,
          kimiSessionId,
          cwd: plan.project?.localPath || undefined
        })) {
          switch (event.type) {
            case 'text':
              accumulatedText += event.data.content
              sendEvent('text', event.data)
              break

            case 'tool':
              sendEvent('tool', event.data)
              break

            case 'result':
              // 优先使用 result 的 content，如果为空则使用累积的 text
              const fullOutput = event.data.content || accumulatedText
              // 解析评审结果
              const reviewResult = parseKimiReviewJson(fullOutput)
              if (reviewResult) {
                // 更新数据库
                await prisma.planReview.update({
                  where: { id: review.id },
                  data: {
                    status: 'completed',
                    score: reviewResult.score,
                    content: JSON.stringify(reviewResult),
                    completedAt: new Date()
                  }
                })
                sendEvent('result', {
                  reviewId: review.id,
                  ...reviewResult
                })
              } else {
                // 无法解析 JSON，仍然标记为完成但没有结构化数据
                await prisma.planReview.update({
                  where: { id: review.id },
                  data: {
                    status: 'completed',
                    content: fullOutput,
                    completedAt: new Date()
                  }
                })
                sendEvent('result', {
                  reviewId: review.id,
                  raw: fullOutput,
                  parseError: 'Failed to parse structured review result'
                })
              }
              break

            case 'error':
              await prisma.planReview.update({
                where: { id: review.id },
                data: {
                  status: 'error',
                  error: event.data.message,
                  completedAt: new Date()
                }
              })
              sendEvent('error', event.data)
              break

            case 'done':
              sendEvent('done', {})
              break
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        await prisma.planReview.update({
          where: { id: review.id },
          data: {
            status: 'error',
            error: errorMessage,
            completedAt: new Date()
          }
        })
        sendEvent('error', { message: errorMessage })
        sendEvent('done', {})
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

/**
 * GET /api/plans/[planId]/kimi-review
 * 获取评审历史
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params

  const reviews = await prisma.planReview.findMany({
    where: { planId },
    orderBy: { createdAt: 'desc' }
  })

  return Response.json({ reviews })
}
