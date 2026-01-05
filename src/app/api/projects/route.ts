/**
 * /api/projects
 * GET - 获取当前用户的项目列表
 * POST - 创建新项目
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET /api/projects - 获取项目列表
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 全员共享：所有用户可以看到所有项目
    const projects = await prisma.project.findMany({
      include: {
        user: {
          select: {
            id: true,
            slackUsername: true,
            avatarUrl: true,
          },
        },
        plans: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: { plans: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Get projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects - 创建新项目
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    if (!body.name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        userId: user.id,
        gitUrl: body.gitUrl,
        gitBranch: body.gitBranch || 'main',
        localPath: body.localPath,
        techStack: body.techStack || [],
      },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
