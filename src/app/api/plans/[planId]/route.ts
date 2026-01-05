/**
 * /api/plans/[planId]
 * GET - 获取计划详情（包含所有任务和对话）
 * PATCH - 更新计划
 * DELETE - 删除计划
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ planId: string }>
}

// GET /api/plans/[planId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await params

  try {
    const plan = await prisma.plan.findFirst({
      where: {
        id: planId,
        project: {
          userId: user.id,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            techStack: true,
            localPath: true,
          },
        },
        tasks: {
          orderBy: { sortOrder: 'asc' },
        },
        conversations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Get plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/plans/[planId]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await params

  try {
    // 验证计划属于当前用户
    const existing = await prisma.plan.findFirst({
      where: {
        id: planId,
        project: { userId: user.id },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const body = await request.json()

    const plan = await prisma.plan.update({
      where: { id: planId },
      data: {
        name: body.name,
        description: body.description,
        status: body.status,
        sessionId: body.sessionId,
      },
    })

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Update plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/plans/[planId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await params

  try {
    // 验证计划属于当前用户
    const existing = await prisma.plan.findFirst({
      where: {
        id: planId,
        project: { userId: user.id },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    await prisma.plan.delete({
      where: { id: planId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
