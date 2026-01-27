/**
 * /api/projects/[id]/plans
 * GET - 获取项目下的计划列表
 * POST - 创建新计划
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id]/plans
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    // 全员共享：仅验证项目存在
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const plans = await prisma.plan.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { tasks: true, conversations: true },
        },
        creator: {
          select: {
            id: true,
            slackUsername: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ plans })
  } catch (error) {
    console.error('Get plans error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/plans
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    // 全员共享：仅验证项目存在
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()

    if (!body.name) {
      return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })
    }

    const plan = await prisma.plan.create({
      data: {
        projectId,
        name: body.name,
        description: body.description,
      },
    })

    return NextResponse.json({ plan }, { status: 201 })
  } catch (error) {
    console.error('Create plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
