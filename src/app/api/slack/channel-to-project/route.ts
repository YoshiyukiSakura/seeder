/**
 * /api/slack/channel-to-project
 * GET - 根据 Slack Channel ID 查询关联的项目信息
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/slack/channel-to-project?channelId=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const channelId = searchParams.get('channelId')

  // 验证 channelId 参数
  if (!channelId || typeof channelId !== 'string') {
    return NextResponse.json(
      { error: 'channelId is required and must be a string' },
      { status: 400 }
    )
  }

  try {
    const project = await prisma.project.findFirst({
      where: { slackChannelId: channelId },
      select: {
        id: true,
        name: true,
        localPath: true,
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'No project found for this channel' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      projectId: project.id,
      projectName: project.name,
      projectPath: project.localPath || undefined,
    })
  } catch (error) {
    console.error('Channel to project lookup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}