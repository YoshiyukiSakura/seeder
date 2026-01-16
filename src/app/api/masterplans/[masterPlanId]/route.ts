/**
 * /api/masterplans/[masterPlanId]
 * GET - 获取主计划详情（含所有子Plan）
 * PATCH - 更新主计划
 * DELETE - 删除主计划
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ masterPlanId: string }>
}

// GET /api/masterplans/[masterPlanId] - 获取主计划详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { masterPlanId } = await params

    const masterPlan = await prisma.masterPlan.findUnique({
      where: { id: masterPlanId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        plans: {
          include: {
            tasks: {
              select: {
                id: true,
                title: true,
                estimateHours: true,
              },
            },
            _count: {
              select: { tasks: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!masterPlan) {
      return NextResponse.json({ error: 'Master plan not found' }, { status: 404 })
    }

    // 计算每个 Plan 的统计数据
    const plansWithStats = masterPlan.plans.map((plan) => {
      const totalEstimate = plan.tasks.reduce((sum, task) => sum + (task.estimateHours || 0), 0)

      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        status: plan.status,
        blockedByPlanIds: plan.blockedByPlanIds,
        sortOrder: plan.sortOrder,
        taskCount: plan._count.tasks,
        totalEstimate,
        publishedAt: plan.publishedAt?.toISOString(),
        createdAt: plan.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      masterPlan: {
        id: masterPlan.id,
        projectId: masterPlan.projectId,
        project: masterPlan.project,
        name: masterPlan.name,
        description: masterPlan.description,
        status: masterPlan.status,
        publishedAt: masterPlan.publishedAt?.toISOString(),
        createdAt: masterPlan.createdAt.toISOString(),
        updatedAt: masterPlan.updatedAt.toISOString(),
        plans: plansWithStats,
      },
    })
  } catch (error) {
    console.error('Get master plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/masterplans/[masterPlanId] - 更新主计划
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { masterPlanId } = await params
    const body = await request.json()

    // 验证主计划存在
    const existing = await prisma.masterPlan.findUnique({
      where: { id: masterPlanId },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Master plan not found' }, { status: 404 })
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) {
      updateData.name = body.name
    }

    if (body.description !== undefined) {
      updateData.description = body.description
    }

    if (body.status !== undefined) {
      updateData.status = body.status

      // 发布时记录时间
      if (body.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
        updateData.publishedAt = new Date()
      }
    }

    const masterPlan = await prisma.masterPlan.update({
      where: { id: masterPlanId },
      data: updateData,
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            status: true,
            blockedByPlanIds: true,
            sortOrder: true,
            _count: {
              select: { tasks: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json({
      masterPlan: {
        id: masterPlan.id,
        projectId: masterPlan.projectId,
        name: masterPlan.name,
        description: masterPlan.description,
        status: masterPlan.status,
        publishedAt: masterPlan.publishedAt?.toISOString(),
        createdAt: masterPlan.createdAt.toISOString(),
        updatedAt: masterPlan.updatedAt.toISOString(),
        plans: masterPlan.plans.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          blockedByPlanIds: p.blockedByPlanIds,
          sortOrder: p.sortOrder,
          taskCount: p._count.tasks,
        })),
      },
    })
  } catch (error) {
    console.error('Update master plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/masterplans/[masterPlanId] - 删除主计划
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { masterPlanId } = await params

    // 验证主计划存在
    const existing = await prisma.masterPlan.findUnique({
      where: { id: masterPlanId },
      include: {
        plans: {
          select: { id: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Master plan not found' }, { status: 404 })
    }

    // 如果有关联的子计划，先解除关联（不删除子计划）
    if (existing.plans.length > 0) {
      await prisma.plan.updateMany({
        where: { masterPlanId },
        data: {
          masterPlanId: null,
          blockedByPlanIds: [],
          sortOrder: 0,
        },
      })
    }

    // 删除主计划
    await prisma.masterPlan.delete({
      where: { id: masterPlanId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete master plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
