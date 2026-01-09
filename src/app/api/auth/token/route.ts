/**
 * POST /api/auth/token
 * 供 Slack Bot 调用，生成一次性登录 Token
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

interface TokenRequest {
  slackUserId: string
  slackUsername: string
  slackTeamId?: string
}

export async function POST(request: NextRequest) {
  // 验证请求来自 Bot
  const botSecret = request.headers.get('X-Bot-Secret')
  const expectedSecret = process.env.BOT_SECRET || 'seedbed-bot-secret'

  if (botSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: TokenRequest = await request.json()

    if (!body.slackUserId || !body.slackUsername) {
      return NextResponse.json(
        { error: 'Missing slackUserId or slackUsername' },
        { status: 400 }
      )
    }

    // 生成随机 Token
    const token = randomBytes(32).toString('hex')

    // Token 有效期 1 年（实际上不限制）
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

    // 保存到数据库
    await prisma.loginToken.create({
      data: {
        token,
        slackUserId: body.slackUserId,
        slackUsername: body.slackUsername,
        slackTeamId: body.slackTeamId,
        expiresAt,
      },
    })

    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
