/**
 * /api/plans/[planId]/tasks
 * GET - 获取计划的任务列表
 * POST - 批量添加任务
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ planId: string }>
}

interface TaskInput {
  title: string
  description: string
  priority?: number
  labels?: string[]
  acceptanceCriteria?: string[]
  relatedFiles?: string[]
  estimateHours?: number
  sortOrder?: number
}

// GET /api/plans/[planId]/tasks
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await params

  try {
    // 全员共享：仅验证计划存在
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const tasks = await prisma.task.findMany({
      where: { planId },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/plans/[planId]/tasks
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await params

  try {
    // 全员共享：仅验证计划存在
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const body = await request.json()

    // 支持单个任务或批量任务
    const tasksInput: TaskInput[] = Array.isArray(body.tasks) ? body.tasks : [body]

    // 获取当前最大 sortOrder
    const maxSortOrder = await prisma.task.aggregate({
      where: { planId },
      _max: { sortOrder: true },
    })

    let currentSortOrder = (maxSortOrder._max.sortOrder || 0) + 1

    const tasks = await Promise.all(
      tasksInput.map(async (task) => {
        return prisma.task.create({
          data: {
            planId,
            title: task.title,
            description: task.description || '',
            priority: task.priority ?? 2,
            labels: task.labels || [],
            acceptanceCriteria: task.acceptanceCriteria || [],
            relatedFiles: task.relatedFiles || [],
            estimateHours: task.estimateHours,
            sortOrder: task.sortOrder ?? currentSortOrder++,
          },
        })
      })
    )

    return NextResponse.json({ tasks }, { status: 201 })
  } catch (error) {
    console.error('Create tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
