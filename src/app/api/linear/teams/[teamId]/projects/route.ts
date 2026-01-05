/**
 * GET /api/linear/teams/[teamId]/projects
 * 获取指定团队下的 Linear 项目列表
 */
import { NextRequest, NextResponse } from 'next/server'
import { getFullUser } from '@/lib/auth'
import { createLinearClient, getProjects } from '@/lib/linear/client'

interface RouteParams {
  params: Promise<{ teamId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { teamId } = await params
    const user = await getFullUser(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!user.linearToken) {
      return NextResponse.json(
        { error: 'Linear API Key not configured' },
        { status: 400 }
      )
    }

    const client = createLinearClient(user.linearToken)
    const projects = await getProjects(client, teamId)

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Error fetching Linear projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}
