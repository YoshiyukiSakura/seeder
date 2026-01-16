/**
 * /api/plans/[planId]/tasks/[taskId]
 * DELETE - 删除单个任务（同时清理依赖引用）
 * GET - 获取单个任务详情
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ planId: string; taskId: string }>
}

// GET /api/plans/[planId]/tasks/[taskId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId, taskId } = await params

  try {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        planId,
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        labels: task.labels,
        acceptanceCriteria: task.acceptanceCriteria,
        relatedFiles: task.relatedFiles,
        estimateHours: task.estimateHours,
        sortOrder: task.sortOrder,
        blockedBy: task.blockedByIds,
        position: task.positionX !== null && task.positionY !== null
          ? { x: task.positionX, y: task.positionY }
          : undefined,
      },
    })
  } catch (error) {
    console.error('Get task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/plans/[planId]/tasks/[taskId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId, taskId } = await params

  try {
    // 验证任务存在且属于该计划
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        planId,
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // 找出所有依赖该任务的其他任务
    const dependentTasks = await prisma.task.findMany({
      where: {
        planId,
        blockedByIds: { has: taskId },
      },
    })

    // 使用事务来原子化执行删除操作
    await prisma.$transaction(async (tx) => {
      // 1. 清理所有依赖该任务的 blockedByIds
      for (const dependent of dependentTasks) {
        await tx.task.update({
          where: { id: dependent.id },
          data: {
            blockedByIds: dependent.blockedByIds.filter(id => id !== taskId),
          },
        })
      }

      // 2. 删除任务本身
      await tx.task.delete({
        where: { id: taskId },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully',
      cleanedDependencies: dependentTasks.length,
    })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
