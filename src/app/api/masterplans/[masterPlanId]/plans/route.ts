/**
 * /api/masterplans/[masterPlanId]/plans
 * POST - 添加Plan到主计划
 * PATCH - 批量更新Plan（排序、依赖）
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { detectPlanCycle } from '@/lib/plan-dependency-utils'

interface RouteParams {
  params: Promise<{ masterPlanId: string }>
}

// POST /api/masterplans/[masterPlanId]/plans - 添加Plan到主计划
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { masterPlanId } = await params
    const body = await request.json()

    if (!body.planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    // 验证主计划存在
    const masterPlan = await prisma.masterPlan.findUnique({
      where: { id: masterPlanId },
      include: {
        plans: {
          select: { id: true, sortOrder: true },
          orderBy: { sortOrder: 'desc' },
          take: 1,
        },
      },
    })

    if (!masterPlan) {
      return NextResponse.json({ error: 'Master plan not found' }, { status: 404 })
    }

    // 验证 Plan 存在且属于同一项目
    const plan = await prisma.plan.findUnique({
      where: { id: body.planId },
      select: { id: true, projectId: true, masterPlanId: true },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.projectId !== masterPlan.projectId) {
      return NextResponse.json(
        { error: 'Plan must belong to the same project as the master plan' },
        { status: 400 }
      )
    }

    if (plan.masterPlanId && plan.masterPlanId !== masterPlanId) {
      return NextResponse.json(
        { error: 'Plan already belongs to another master plan' },
        { status: 400 }
      )
    }

    // 计算新的排序值
    const maxSortOrder = masterPlan.plans[0]?.sortOrder ?? -1
    const newSortOrder = body.sortOrder ?? maxSortOrder + 1

    // 更新 Plan 关联到 MasterPlan
    const updatedPlan = await prisma.plan.update({
      where: { id: body.planId },
      data: {
        masterPlanId,
        sortOrder: newSortOrder,
        blockedByPlanIds: body.blockedByPlanIds ?? [],
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    })

    return NextResponse.json({
      plan: {
        id: updatedPlan.id,
        name: updatedPlan.name,
        status: updatedPlan.status,
        blockedByPlanIds: updatedPlan.blockedByPlanIds,
        sortOrder: updatedPlan.sortOrder,
        taskCount: updatedPlan._count.tasks,
      },
    })
  } catch (error) {
    console.error('Add plan to master plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/masterplans/[masterPlanId]/plans - 批量更新Plan（排序、依赖）
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { masterPlanId } = await params
    const body = await request.json()

    if (!Array.isArray(body.plans)) {
      return NextResponse.json({ error: 'Plans array is required' }, { status: 400 })
    }

    // 验证主计划存在
    const masterPlan = await prisma.masterPlan.findUnique({
      where: { id: masterPlanId },
      include: {
        plans: {
          select: { id: true },
        },
      },
    })

    if (!masterPlan) {
      return NextResponse.json({ error: 'Master plan not found' }, { status: 404 })
    }

    // 获取当前 MasterPlan 下的 Plan ID 集合
    const masterPlanPlanIds = new Set(masterPlan.plans.map((p) => p.id))

    // 验证所有要更新的 Plan 都属于此 MasterPlan
    const updatePlanIds = body.plans.map((p: { id: string }) => p.id)
    for (const planId of updatePlanIds) {
      if (!masterPlanPlanIds.has(planId)) {
        return NextResponse.json(
          { error: `Plan ${planId} does not belong to this master plan` },
          { status: 400 }
        )
      }
    }

    // 构建依赖图用于循环检测
    const dependencyMap: Record<string, string[]> = {}
    for (const planUpdate of body.plans) {
      if (planUpdate.blockedByPlanIds) {
        // 验证 blockedByPlanIds 中的 Plan 都属于同一个 MasterPlan
        for (const blockedById of planUpdate.blockedByPlanIds) {
          if (!masterPlanPlanIds.has(blockedById)) {
            return NextResponse.json(
              { error: `Blocked by plan ${blockedById} does not belong to this master plan` },
              { status: 400 }
            )
          }
        }
        dependencyMap[planUpdate.id] = planUpdate.blockedByPlanIds
      }
    }

    // 检测循环依赖
    const cycle = detectPlanCycle(dependencyMap)
    if (cycle) {
      return NextResponse.json(
        { error: `Circular dependency detected: ${cycle.join(' → ')}` },
        { status: 400 }
      )
    }

    // 批量更新 Plan
    const updatePromises = body.plans.map(
      (planUpdate: { id: string; sortOrder?: number; blockedByPlanIds?: string[] }) => {
        const updateData: Record<string, unknown> = {}

        if (planUpdate.sortOrder !== undefined) {
          updateData.sortOrder = planUpdate.sortOrder
        }

        if (planUpdate.blockedByPlanIds !== undefined) {
          updateData.blockedByPlanIds = planUpdate.blockedByPlanIds
        }

        return prisma.plan.update({
          where: { id: planUpdate.id },
          data: updateData,
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
        })
      }
    )

    const updatedPlans = await Promise.all(updatePromises)

    return NextResponse.json({
      plans: updatedPlans.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        blockedByPlanIds: p.blockedByPlanIds,
        sortOrder: p.sortOrder,
        taskCount: p._count.tasks,
      })),
    })
  } catch (error) {
    console.error('Batch update plans error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/masterplans/[masterPlanId]/plans - 从主计划移除Plan（不删除Plan本身）
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { masterPlanId } = await params
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('planId')

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    // 验证 Plan 属于此 MasterPlan
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true, masterPlanId: true },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.masterPlanId !== masterPlanId) {
      return NextResponse.json(
        { error: 'Plan does not belong to this master plan' },
        { status: 400 }
      )
    }

    // 移除关联（不删除 Plan）
    await prisma.plan.update({
      where: { id: planId },
      data: {
        masterPlanId: null,
        blockedByPlanIds: [],
        sortOrder: 0,
      },
    })

    // 同时更新其他依赖此 Plan 的 Plan，移除依赖关系
    await prisma.$executeRaw`
      UPDATE "Plan"
      SET "blockedByPlanIds" = array_remove("blockedByPlanIds", ${planId})
      WHERE "masterPlanId" = ${masterPlanId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove plan from master plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
