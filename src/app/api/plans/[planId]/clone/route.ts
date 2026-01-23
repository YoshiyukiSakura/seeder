/**
 * /api/plans/[planId]/clone
 * POST - 克隆计划（用于 re-publish 功能）
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ planId: string }>
}

// POST /api/plans/[planId]/clone
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await params

  try {
    // 获取原 Plan 及其 Tasks
    const originalPlan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        tasks: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!originalPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // 创建新 Plan（DRAFT 状态）
    const newPlan = await prisma.plan.create({
      data: {
        projectId: originalPlan.projectId,
        name: `${originalPlan.name} (Copy)`,
        description: originalPlan.description,
        masterPlanId: originalPlan.masterPlanId,
        blockedByPlanIds: originalPlan.blockedByPlanIds,
        sortOrder: originalPlan.sortOrder,
        status: 'DRAFT',
        // 不复制: sessionId, summary, publishedAt, pendingQuestion
      },
    })

    // 复制所有 Tasks
    if (originalPlan.tasks.length > 0) {
      await prisma.task.createMany({
        data: originalPlan.tasks.map((task) => ({
          planId: newPlan.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          estimateHours: task.estimateHours,
          labels: task.labels,
          acceptanceCriteria: task.acceptanceCriteria,
          relatedFiles: task.relatedFiles,
          sortOrder: task.sortOrder,
          // 不复制: dependsOnId (可能指向原 Plan 的 task)
        })),
      })
    }

    // 返回新创建的 Plan（包含 tasks）
    const createdPlan = await prisma.plan.findUnique({
      where: { id: newPlan.id },
      include: {
        tasks: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { tasks: true, conversations: true },
        },
      },
    })

    return NextResponse.json({ plan: createdPlan }, { status: 201 })
  } catch (error) {
    console.error('Clone plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
