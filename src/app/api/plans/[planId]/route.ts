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

const CONTROL_CHAR_PATTERN = /[\u0000-\u001f]/g

function sanitizeText(value: string | null | undefined): string | null | undefined {
  if (typeof value !== 'string') return value
  return value.replace(CONTROL_CHAR_PATTERN, '')
}

function sanitizeTextArray(
  value: string[] | null | undefined
): string[] | null | undefined {
  if (!Array.isArray(value)) return value
  return value.map((entry) => sanitizeText(entry) || '')
}

// GET /api/plans/[planId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await params

  try {
    // 全员共享：移除用户限制
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            techStack: true,
            localPath: true,
          },
        },
        masterPlan: {
          select: {
            id: true,
            name: true,
            status: true,
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

    const sanitizedPlan = {
      ...plan,
      name: sanitizeText(plan.name) ?? plan.name,
      description: sanitizeText(plan.description) ?? plan.description,
      tasks: plan.tasks.map((task) => ({
        ...task,
        title: sanitizeText(task.title) ?? task.title,
        description: sanitizeText(task.description) ?? task.description,
        labels: sanitizeTextArray(task.labels) ?? task.labels,
        acceptanceCriteria:
          sanitizeTextArray(task.acceptanceCriteria) ?? task.acceptanceCriteria,
        relatedFiles: sanitizeTextArray(task.relatedFiles) ?? task.relatedFiles,
      })),
      conversations: plan.conversations.map((conversation) => ({
        ...conversation,
        content: sanitizeText(conversation.content) ?? conversation.content,
      })),
    }

    return NextResponse.json({ plan: sanitizedPlan })
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
    // 全员共享：仅验证计划存在
    const existing = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const body = await request.json()

    // 检测是否是发布操作
    const isPublishing = body.status === 'PUBLISHED' && existing.status !== 'PUBLISHED'

    // 如果是发布操作，并行生成摘要和标题
    let summary: string | undefined
    let generatedTitle: string | undefined
    if (isPublishing) {
      const { generatePlanSummary } = await import('@/lib/summary-generator')
      const { generatePlanTitle } = await import('@/lib/title-generator')

      const [summaryResult, titleResult] = await Promise.allSettled([
        generatePlanSummary(planId),
        generatePlanTitle(planId)
      ])

      if (summaryResult.status === 'fulfilled') {
        summary = summaryResult.value
        console.log(`Generated summary for plan ${planId}: ${summary}`)
      } else {
        console.error('Failed to generate summary:', summaryResult.reason)
      }

      if (titleResult.status === 'fulfilled') {
        generatedTitle = titleResult.value
        console.log(`Generated title for plan ${planId}: ${generatedTitle}`)
      } else {
        console.error('Failed to generate title:', titleResult.reason)
      }
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.status !== undefined) updateData.status = body.status
    if (body.sessionId !== undefined) updateData.sessionId = body.sessionId
    if (body.masterPlanId !== undefined) updateData.masterPlanId = body.masterPlanId
    if (body.blockedByPlanIds !== undefined) updateData.blockedByPlanIds = body.blockedByPlanIds
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder
    if (isPublishing) updateData.publishedAt = new Date()
    if (summary) updateData.summary = summary
    if (generatedTitle) updateData.name = generatedTitle

    const plan = await prisma.plan.update({
      where: { id: planId },
      data: updateData,
      include: {
        masterPlan: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
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
    // 全员共享：仅验证计划存在
    const existing = await prisma.plan.findUnique({
      where: { id: planId },
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
