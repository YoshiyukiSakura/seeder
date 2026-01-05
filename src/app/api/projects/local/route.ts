/**
 * /api/projects/local
 * GET - 扫描 PROJECTS_ROOT 目录下的本地项目
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { scanLocalProjects, type LocalProject } from '@/lib/project-scanner'

export interface LocalProjectsResponse {
  projects: LocalProject[]
  projectsRoot: string
}

// GET /api/projects/local - 获取本地项目列表
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const projectsRoot = process.env.PROJECTS_ROOT || '/data/repos'
    const projects = await scanLocalProjects(projectsRoot)

    return NextResponse.json({
      projects,
      projectsRoot,
    } satisfies LocalProjectsResponse)
  } catch (error) {
    console.error('Scan local projects error:', error)
    return NextResponse.json(
      { error: 'Failed to scan local projects', details: String(error) },
      { status: 500 }
    )
  }
}
