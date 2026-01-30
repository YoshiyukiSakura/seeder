/**
 * /api/slack/thread-to-plan
 * GET - 根据 Slack Channel ID 和 Thread Timestamp 查询关联的 Plan 信息
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/slack/thread-to-plan?channelId=xxx&threadTs=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const channelId = searchParams.get('channelId')
  const threadTs = searchParams.get('threadTs')

  // 验证 channelId 参数
  if (!channelId || typeof channelId !== 'string') {
    return NextResponse.json(
      { error: 'channelId is required and must be a string' },
      { status: 400 }
    )
  }

  // 验证 threadTs 参数
  if (!threadTs || typeof threadTs !== 'string') {
    return NextResponse.json(
      { error: 'threadTs is required and must be a string' },
      { status: 400 }
    )
  }

  try {
    const plan = await prisma.plan.findFirst({
      where: {
        slackChannelId: channelId,
        slackThreadTs: threadTs,
      },
      select: {
        id: true,
        name: true,
        sessionId: true,
        project: {
          select: {
            localPath: true,
          },
        },
      },
    })

    if (!plan) {
      return NextResponse.json(
        { error: 'No plan found for this channel and thread' },
        { status: 404 }
      )
    }

    // 检查 sessionId 是否存在（会话可能还在初始化中）
    if (!plan.sessionId) {
      return NextResponse.json(
        {
          error: 'Session not ready yet',
          code: 'SESSION_NOT_READY',
          planId: plan.id,
          planName: plan.name,
        },
        { status: 503 }  // Service Unavailable - 临时状态
      )
    }

    return NextResponse.json({
      planId: plan.id,
      planName: plan.name,
      sessionId: plan.sessionId,
      projectPath: plan.project?.localPath || undefined,
    })
  } catch (error) {
    console.error('Thread to plan lookup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}