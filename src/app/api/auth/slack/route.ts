/**
 * GET /api/auth/slack
 * 验证一次性 Token 并登录用户
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SignJWT } from 'jose'
import { basePath } from '@/lib/basePath'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return redirectWithError(request, 'missing_token')
  }

  try {
    // 1. 查找 Token
    const loginToken = await prisma.loginToken.findUnique({
      where: { token },
    })

    if (!loginToken) {
      return redirectWithError(request, 'invalid_token')
    }

    // 2. 检查是否已使用
    if (loginToken.usedAt) {
      return redirectWithError(request, 'token_used')
    }

    // 3. 检查是否过期
    if (loginToken.expiresAt < new Date()) {
      return redirectWithError(request, 'token_expired')
    }

    // 4. 标记 Token 已使用
    await prisma.loginToken.update({
      where: { id: loginToken.id },
      data: { usedAt: new Date() },
    })

    // 5. 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { slackUserId: loginToken.slackUserId },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          slackUserId: loginToken.slackUserId,
          slackUsername: loginToken.slackUsername,
          slackTeamId: loginToken.slackTeamId,
        },
      })
    }

    // 6. 签发 JWT
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

    // 7. 设置 Cookie 并重定向到首页
    const baseUrl = new URL(request.url).origin
    const response = NextResponse.redirect(new URL(`${basePath}/`, baseUrl))
    response.cookies.set('auth-token', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 天
      path: basePath || '/',
    })

    return response
  } catch (error) {
    console.error('Auth error:', error)
    return redirectWithError(request, 'server_error')
  }
}

function redirectWithError(request: NextRequest, error: string) {
  const baseUrl = new URL(request.url).origin
  return NextResponse.redirect(new URL(`${basePath}/auth?error=${error}`, baseUrl))
}
