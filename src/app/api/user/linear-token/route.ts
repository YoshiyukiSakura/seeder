/**
 * PUT /api/user/linear-token
 * 更新用户的 Linear API Token
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateApiKey } from '@/lib/linear/client'

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { linearToken } = body

    if (!linearToken || typeof linearToken !== 'string') {
      return NextResponse.json(
        { error: 'linearToken is required' },
        { status: 400 }
      )
    }

    // 验证 token 是否有效
    const linearUser = await validateApiKey(linearToken)

    if (!linearUser) {
      return NextResponse.json(
        { error: 'Invalid Linear API Key' },
        { status: 400 }
      )
    }

    // 保存 token
    await prisma.user.update({
      where: { id: user.id },
      data: { linearToken },
    })

    return NextResponse.json({
      success: true,
      linearUser,
    })
  } catch (error) {
    console.error('Error updating Linear token:', error)
    return NextResponse.json(
      { error: 'Failed to update Linear token' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 删除 token
    await prisma.user.update({
      where: { id: user.id },
      data: { linearToken: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting Linear token:', error)
    return NextResponse.json(
      { error: 'Failed to delete Linear token' },
      { status: 500 }
    )
  }
}
