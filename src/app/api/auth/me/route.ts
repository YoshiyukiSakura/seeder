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
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
    })

    if (!user) {
      // Token 有效但用户不存在，清除 cookie
      const response = NextResponse.json({ user: null }, { status: 200 })
      response.cookies.set('auth-token', '', { maxAge: 0, path: '/' })
      return response
    }

    return NextResponse.json({ user })
  } catch (error) {
    // Token 无效或过期
    const response = NextResponse.json({ user: null }, { status: 200 })
    response.cookies.set('auth-token', '', { maxAge: 0, path: '/' })
    return response
  }
}
