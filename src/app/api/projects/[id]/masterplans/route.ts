/**
 * /api/projects/[id]/masterplans
 * GET - 获取项目的主计划列表
 * POST - 创建主计划
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id]/masterplans - 获取项目的主计划列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: projectId } = await params

    // 验证项目存在
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const masterPlans = await prisma.masterPlan.findMany({
      where: { projectId },
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            blockedByPlanIds: true,
            sortOrder: true,
            _count: {
              select: { tasks: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { plans: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // 转换响应格式
    const response = masterPlans.map((mp) => ({
      id: mp.id,
      projectId: mp.projectId,
      name: mp.name,
      description: mp.description,
      status: mp.status,
      publishedAt: mp.publishedAt?.toISOString(),
      createdAt: mp.createdAt.toISOString(),
      updatedAt: mp.updatedAt.toISOString(),
      planCount: mp._count.plans,
      plans: mp.plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        blockedByPlanIds: p.blockedByPlanIds,
        sortOrder: p.sortOrder,
        taskCount: p._count.tasks,
      })),
    }))

    return NextResponse.json({ masterPlans: response })
  } catch (error) {
    console.error('Get master plans error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/masterplans - 创建主计划
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: projectId } = await params
    const body = await request.json()

    if (!body.name) {
      return NextResponse.json({ error: 'Master plan name is required' }, { status: 400 })
    }

    // 验证项目存在
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const masterPlan = await prisma.masterPlan.create({
      data: {
        projectId,
        name: body.name,
        description: body.description,
      },
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            status: true,
            blockedByPlanIds: true,
            sortOrder: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        masterPlan: {
          id: masterPlan.id,
          projectId: masterPlan.projectId,
          name: masterPlan.name,
          description: masterPlan.description,
          status: masterPlan.status,
          publishedAt: masterPlan.publishedAt?.toISOString(),
          createdAt: masterPlan.createdAt.toISOString(),
          updatedAt: masterPlan.updatedAt.toISOString(),
          plans: masterPlan.plans,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create master plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
