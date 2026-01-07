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
  blockedBy?: string[]  // 阻塞该任务的其他任务 ID
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

// PUT /api/plans/[planId]/tasks - 替换所有任务
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await params

  try {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const body = await request.json()
    const tasksInput: TaskInput[] = Array.isArray(body.tasks) ? body.tasks : []

    // 删除现有任务，创建新任务（事务）
    const tasks = await prisma.$transaction(async (tx) => {
      // 删除该 plan 的所有现有 tasks
      await tx.task.deleteMany({
        where: { planId },
      })

      // 第一步：创建所有 tasks（暂时不设置 blockedByIds）
      const created = await Promise.all(
        tasksInput.map((task, index) =>
          tx.task.create({
            data: {
              planId,
              title: task.title,
              description: task.description || '',
              priority: task.priority ?? 2,
              labels: task.labels || [],
              acceptanceCriteria: task.acceptanceCriteria || [],
              relatedFiles: task.relatedFiles || [],
              estimateHours: task.estimateHours,
              sortOrder: task.sortOrder ?? index,
            },
          })
        )
      )

      // 第二步：建立 旧ID -> 新ID 的映射（通过 sortOrder）
      // 前端发送的 blockedBy 是前端生成的临时 ID
      // 我们通过 sortOrder 来映射：blockedBy[i] 对应 sortOrder=i 的任务
      const sortOrderToNewId = new Map<number, string>()
      created.forEach((task, index) => {
        sortOrderToNewId.set(index, task.id)
      })

      // 第三步：更新每个任务的 blockedByIds
      for (let i = 0; i < tasksInput.length; i++) {
        const input = tasksInput[i]
        const createdTask = created[i]

        if (input.blockedBy && input.blockedBy.length > 0) {
          // 将前端的 blockedBy ID 转换为新的数据库 ID
          // blockedBy 包含的是前端生成的 ID，格式如 "task-123456-{index}"
          // 我们需要从中提取 index，然后映射到新的数据库 ID
          const newBlockedByIds: string[] = []

          for (const oldId of input.blockedBy) {
            // 尝试从 ID 中提取索引（格式：task-{timestamp}-{index}）
            const match = oldId.match(/-(\d+)$/)
            if (match) {
              const index = parseInt(match[1], 10)
              const newId = sortOrderToNewId.get(index)
              if (newId) {
                newBlockedByIds.push(newId)
              }
            }
          }

          if (newBlockedByIds.length > 0) {
            await tx.task.update({
              where: { id: createdTask.id },
              data: { blockedByIds: newBlockedByIds },
            })
            // 更新本地对象以返回正确的数据
            created[i] = { ...createdTask, blockedByIds: newBlockedByIds }
          }
        }
      }

      return created
    })

    return NextResponse.json({ tasks, replaced: true })
  } catch (error) {
    console.error('Replace tasks error:', error)
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
