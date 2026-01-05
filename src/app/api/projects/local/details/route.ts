/**
 * /api/projects/local/details
 * GET - 获取本地项目的详细信息（技术栈、README 等）
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getProjectDetails, type ProjectDetails } from '@/lib/project-scanner'

export interface ProjectDetailsResponse {
  project: ProjectDetails
}

// GET /api/projects/local/details?path=/path/to/project
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const projectPath = request.nextUrl.searchParams.get('path')

  if (!projectPath) {
    return NextResponse.json(
      { error: 'Project path is required' },
      { status: 400 }
    )
  }

  // 安全检查：确保路径在 PROJECTS_ROOT 下
  const projectsRoot = process.env.PROJECTS_ROOT || '/data/repos'
  if (!projectPath.startsWith(projectsRoot)) {
    return NextResponse.json(
      { error: 'Invalid project path' },
      { status: 403 }
    )
  }

  try {
    const project = await getProjectDetails(projectPath)

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or not a valid project' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      project,
    } satisfies ProjectDetailsResponse)
  } catch (error) {
    console.error('Get project details error:', error)
    return NextResponse.json(
      { error: 'Failed to get project details', details: String(error) },
      { status: 500 }
    )
  }
}
