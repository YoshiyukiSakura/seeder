/**
 * /api/projects
 * GET - 获取当前用户的项目列表
 * POST - 创建新项目
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cloneRepository, validateGitUrl, generateLocalPath } from '@/lib/git-utils'

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

    const projectId =
      typeof body.id === 'string' && body.id.trim().length > 0
        ? body.id.trim()
        : undefined

    if (projectId) {
      const existing = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'Project already exists', projectId },
          { status: 409 }
        )
      }
    }

    // Determine localPath - either from git clone or provided directly
    let localPath = body.localPath

    // If gitUrl is provided, clone the repository
    if (body.gitUrl) {
      // Validate git URL format
      if (!validateGitUrl(body.gitUrl)) {
        return NextResponse.json(
          { error: 'Invalid Git URL format. Use HTTPS (https://...) or SSH (git@...) format.' },
          { status: 400 }
        )
      }

      // Generate local path for the clone
      try {
        localPath = generateLocalPath(user.id, body.gitUrl)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        )
      }

      // Clone the repository
      const cloneResult = await cloneRepository(
        body.gitUrl,
        localPath,
        body.gitBranch
      )

      if (!cloneResult.success) {
        return NextResponse.json(
          { error: cloneResult.error },
          { status: 400 }
        )
      }

      localPath = cloneResult.path
    }

    const project = await prisma.project.create({
      data: {
        ...(projectId ? { id: projectId } : {}),
        name: body.name,
        description: body.description,
        userId: user.id,
        gitUrl: body.gitUrl,
        gitBranch: body.gitBranch || 'main',
        localPath: localPath,
        techStack: body.techStack || [],
      },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
