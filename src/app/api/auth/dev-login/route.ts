/**
 * POST /api/auth/dev-login
 * 开发环境专用登录 - 仅在 NODE_ENV=development 时可用
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SignJWT } from 'jose'

const DEV_USER = {
  slackUserId: 'DEV_USER_001',
  slackUsername: 'dev-user',
  slackTeamId: 'DEV_TEAM',
}

export async function POST(request: NextRequest) {
  // 安全检查：仅开发环境可用
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Dev login is not available in production' },
      { status: 403 }
    )
  }

  try {
    // 查找或创建开发用户
    let user = await prisma.user.findUnique({
      where: { slackUserId: DEV_USER.slackUserId },
    })

    if (!user) {
      user = await prisma.user.create({
        data: DEV_USER,
      })
    }

    // 签发 JWT
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret')
    const jwt = await new SignJWT({
      userId: user.id,
      slackUserId: user.slackUserId,
      slackUsername: user.slackUsername,
      slackTeamId: user.slackTeamId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret)

    // 返回成功，设置 Cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set('auth-token', jwt, {
      httpOnly: true,
      secure: false, // 开发环境不需要 HTTPS
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 天
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Dev login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
