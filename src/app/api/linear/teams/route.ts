/**
 * GET /api/linear/teams
 * 获取用户所属的 Linear 团队列表
 */
import { NextRequest, NextResponse } from 'next/server'
import { getFullUser } from '@/lib/auth'
import { createLinearClient, getTeams } from '@/lib/linear/client'

export async function GET(request: NextRequest) {
  try {
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
    const teams = await getTeams(client)

    return NextResponse.json({ teams })
  } catch (error) {
    console.error('Error fetching Linear teams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}
