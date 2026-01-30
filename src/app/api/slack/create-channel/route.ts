/**
 * /api/slack/create-channel
 * POST - 为项目创建 Slack 频道
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeChannelName } from '@/lib/slack-utils'

const SLACK_API_BASE = 'https://slack.com/api'

async function createSlackChannel(name: string, isPrivate: boolean = false): Promise<{
  ok: boolean
  channel?: { id: string; name: string }
  error?: string
}> {
  const token = process.env.SLACK_BOT_TOKEN!

  const response = await fetch(`${SLACK_API_BASE}/conversations.create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: normalizeChannelName(name),
      is_private: isPrivate,
    }),
  })

  const data = await response.json()
  return data
}

/**
 * 调用 Slack conversations.setTopic API 设置频道 Topic
 */
async function setSlackChannelTopic(channelId: string, topic: string): Promise<{
  ok: boolean
  error?: string
}> {
  const token = process.env.SLACK_BOT_TOKEN!

  const response = await fetch(`${SLACK_API_BASE}/conversations.setTopic`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      topic,
    }),
  })

  const data = await response.json()
  return data
}

// POST /api/slack/create-channel
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
    const { projectId } = body

    // 验证 projectId 参数
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

    // 如果项目已有频道，返回现有信息
    if (project.slackChannelId && project.slackChannelName) {
      return NextResponse.json({
        success: true,
        message: 'Channel already exists',
        channelId: project.slackChannelId,
        channelName: project.slackChannelName,
      })
    }

    // 创建 Slack 频道
    const channelName = `project-${normalizeChannelName(project.name, 60)}`
    const createResult = await createSlackChannel(channelName)

    if (!createResult.ok || !createResult.channel) {
      console.error('Failed to create Slack channel:', createResult.error)
      return NextResponse.json(
        { error: `Failed to create Slack channel: ${createResult.error}` },
        { status: 500 }
      )
    }

    // 设置频道 Topic
    const topic = `Seedbed Project: ${project.name}`
    await setSlackChannelTopic(createResult.channel.id, topic)

    // 更新项目数据库
    await prisma.project.update({
      where: { id: projectId },
      data: {
        slackChannelId: createResult.channel.id,
        slackChannelName: createResult.channel.name,
      },
    })

    return NextResponse.json({
      success: true,
      channelId: createResult.channel.id,
      channelName: createResult.channel.name,
    })
  } catch (error) {
    console.error('Create channel error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}