/**
 * /api/projects/[id]
 * GET - 获取单个项目详情
 * PATCH - 更新项目
 * DELETE - 删除项目
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        plans: {
          include: {
            _count: {
              select: { tasks: true, conversations: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/projects/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    // 验证项目属于当前用户
    const existing = await prisma.project.findFirst({
      where: { id, userId: user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        gitUrl: body.gitUrl,
        gitBranch: body.gitBranch,
        localPath: body.localPath,
        techStack: body.techStack,
        conventions: body.conventions,
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Update project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    // 验证项目属于当前用户
    const existing = await prisma.project.findFirst({
      where: { id, userId: user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 删除项目（级联删除 plans, tasks, conversations）
    await prisma.project.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
