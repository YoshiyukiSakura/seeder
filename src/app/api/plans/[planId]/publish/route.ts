/**
 * POST /api/plans/[planId]/publish
 * 将计划发布到 Linear
 */
import { NextRequest, NextResponse } from 'next/server'
import { getFullUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLinearClient } from '@/lib/linear/client'
import { publishToLinear, TaskToPublish } from '@/lib/linear/publish'

interface RouteParams {
  params: Promise<{ planId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { planId } = await params
    const user = await getFullUser(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!user.linearToken) {
      return NextResponse.json(
        { error: 'Linear API Key not configured. Please configure it in Settings.' },
        { status: 400 }
      )
    }

    // 解析请求体
    const body = await request.json()
    const { teamId, projectId, createMetaIssue = true } = body

    if (!teamId) {
      return NextResponse.json(
        { error: 'teamId is required' },
        { status: 400 }
      )
    }

    // 全员共享：仅验证计划存在
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        tasks: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    if (plan.tasks.length === 0) {
      return NextResponse.json(
        { error: 'Plan has no tasks to publish' },
        { status: 400 }
      )
    }

    // 转换任务格式
    const tasksToPublish: TaskToPublish[] = plan.tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      labels: task.labels,
      acceptanceCriteria: task.acceptanceCriteria,
      relatedFiles: task.relatedFiles,
      estimateHours: task.estimateHours,
    }))

    // 发布到 Linear
    const client = createLinearClient(user.linearToken)
    const result = await publishToLinear(client, tasksToPublish, {
      teamId,
      projectId: projectId || undefined,
      createMetaIssue,
      planName: plan.name,
    })

    // 更新数据库中的 linearIssueId
    for (const issue of result.issues) {
      await prisma.task.update({
        where: { id: issue.taskId },
        data: { linearIssueId: issue.linearIssueId },
      })
    }

    // 更新计划状态
    await prisma.plan.update({
      where: { id: planId },
      data: {
        status: 'PUBLISHED',
        linearProjectId: projectId || null,
        publishedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: result.success,
      publishedCount: result.issues.length,
      totalCount: plan.tasks.length,
      issues: result.issues,
      metaIssue: result.metaIssue,
      errors: result.errors,
    })
  } catch (error) {
    console.error('Error publishing to Linear:', error)
    return NextResponse.json(
      { error: 'Failed to publish to Linear' },
      { status: 500 }
    )
  }
}
