/**
 * /api/slack/list-projects
 * GET - 获取所有项目列表（供 Slack Bot 使用）
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/slack/search-projects
export async function GET(request: NextRequest) {
  // 验证 Bot Secret
  const botSecret = request.headers.get('x-bot-secret')
  if (!process.env.BOT_SECRET) {
    return NextResponse.json(
      { error: 'Server configuration error: BOT_SECRET not configured' },
      { status: 500 }
    )
  }
  if (botSecret !== process.env.BOT_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid bot secret' },
      { status: 401 }
    )
  }

  try {
    // 获取所有项目
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        slackChannelId: true,
        slackChannelName: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        hasChannel: !!p.slackChannelId,
        channelName: p.slackChannelName,
      })),
    })
  } catch (error) {
    console.error('List projects error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
