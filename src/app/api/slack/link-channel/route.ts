/**
 * /api/slack/link-channel
 * POST - 将现有 Slack 频道关联到项目
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SLACK_API_BASE = 'https://slack.com/api'

/**
 * 获取 Slack 频道信息
 */
async function getSlackChannelInfo(channelId: string): Promise<{
  ok: boolean
  channel?: { id: string; name: string }
  error?: string
}> {
  const token = process.env.SLACK_BOT_TOKEN!

  const response = await fetch(`${SLACK_API_BASE}/conversations.info`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
    }),
  })

  const data = await response.json()
  return data
}

// POST /api/slack/link-channel
export async function POST(request: NextRequest) {
  try {
    // 验证 Bot Secret
    const botSecret = request.headers.get('x-bot-secret')
    if (!process.env.BOT_SECRET) {
      console.error('BOT_SECRET is not configured')
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

    // 验证 SLACK_BOT_TOKEN
    if (!process.env.SLACK_BOT_TOKEN) {
      console.error('SLACK_BOT_TOKEN is not configured')
      return NextResponse.json(
        { error: 'Server configuration error: SLACK_BOT_TOKEN not configured' },
        { status: 500 }
      )
    }

    // 解析请求体
    const body = await request.json()
    const { channelId, projectId } = body

    // 验证参数
    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json(
        { error: 'channelId is required and must be a string' },
        { status: 400 }
      )
    }
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'projectId is required and must be a string' },
        { status: 400 }
      )
    }

    // 查询项目信息
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        slackChannelId: true,
        slackChannelName: true,
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // 检查是否有其他项目已关联此频道
    const existingProject = await prisma.project.findFirst({
      where: {
        slackChannelId: channelId,
        id: { not: projectId },
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (existingProject) {
      return NextResponse.json(
        { error: `This channel is already linked to project "${existingProject.name}"` },
        { status: 409 }
      )
    }

    // 获取频道信息
    const channelInfo = await getSlackChannelInfo(channelId)
    if (!channelInfo.ok || !channelInfo.channel) {
      console.error('Failed to get Slack channel info:', channelInfo.error)
      return NextResponse.json(
        { error: `Failed to get channel info: ${channelInfo.error}` },
        { status: 500 }
      )
    }

    const channelName = channelInfo.channel.name

    // 更新项目数据库
    await prisma.project.update({
      where: { id: projectId },
      data: {
        slackChannelId: channelId,
        slackChannelName: channelName,
      },
    })

    return NextResponse.json({
      success: true,
      channelId: channelId,
      channelName: channelName,
      projectName: project.name,
    })
  } catch (error) {
    console.error('Link channel error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
