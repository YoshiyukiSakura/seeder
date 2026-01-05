/**
 * 认证工具库
 * 提供 JWT 验证和用户获取功能
 */

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, JWTPayload } from 'jose'
import { prisma } from './prisma'
import { User } from '@/generated/prisma/client'

export interface AuthUser {
  id: string
  slackUserId: string
  slackUsername: string
  email: string | null
  avatarUrl: string | null
}

interface TokenPayload extends JWTPayload {
  userId: string
  slackUserId: string
  slackUsername: string
}

/**
 * 从请求中获取当前用户
 * @returns 用户信息或 null
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    return null
  }

  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret')
    const { payload } = await jwtVerify(token, secret)
    const tokenPayload = payload as TokenPayload

    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.userId },
      select: {
        id: true,
        slackUserId: true,
        slackUsername: true,
        email: true,
        avatarUrl: true,
      },
    })

    return user
  } catch {
    return null
  }
}

/**
 * 需要认证的 API 包装器
 * 如果未登录，返回 401 响应
 */
export async function withAuth<T>(
  request: NextRequest,
  handler: (user: AuthUser) => Promise<NextResponse<T>>
): Promise<NextResponse<T | { error: string }>> {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return handler(user)
}

/**
 * 获取完整用户对象（包含所有字段）
 */
export async function getFullUser(request: NextRequest): Promise<User | null> {
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    return null
  }

  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret')
    const { payload } = await jwtVerify(token, secret)
    const tokenPayload = payload as TokenPayload

    return await prisma.user.findUnique({
      where: { id: tokenPayload.userId },
    })
  } catch {
    return null
  }
}
