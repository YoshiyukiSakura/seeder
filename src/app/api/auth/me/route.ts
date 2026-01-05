/**
 * GET /api/auth/me
 * 获取当前登录用户信息
 */

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'

interface JWTPayload {
  userId: string
  slackUserId: string
  slackUsername: string
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    return NextResponse.json({ user: null }, { status: 200 })
  }

  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret')
    const { payload } = await jwtVerify(token, secret)
    const jwtPayload = payload as unknown as JWTPayload

    // 从数据库获取完整用户信息
    const user = await prisma.user.findUnique({
      where: { id: jwtPayload.userId },
      select: {
        id: true,
        slackUserId: true,
        slackUsername: true,
        slackTeamId: true,
        email: true,
        avatarUrl: true,
        linearToken: true,
        createdAt: true,
      },
    })

    if (!user) {
      // Token 有效但用户不存在，清除 cookie
      const response = NextResponse.json({ user: null }, { status: 200 })
      response.cookies.set('auth-token', '', { maxAge: 0, path: '/' })
      return response
    }

    // 如果配置了 Linear token，获取 Linear 用户信息
    let linearUser = null
    if (user.linearToken) {
      try {
        const { validateApiKey } = await import('@/lib/linear/client')
        linearUser = await validateApiKey(user.linearToken)
      } catch {
        // Linear token 可能已失效
      }
    }

    // 不返回实际的 token 值，只返回是否配置
    const { linearToken, ...userWithoutToken } = user

    return NextResponse.json({
      user: {
        ...userWithoutToken,
        linearConfigured: !!linearToken,
      },
      linearUser,
    })
  } catch (error) {
    // Token 无效或过期
    const response = NextResponse.json({ user: null }, { status: 200 })
    response.cookies.set('auth-token', '', { maxAge: 0, path: '/' })
    return response
  }
}
