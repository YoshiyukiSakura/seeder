/**
 * POST /api/linear/validate
 * 验证 Linear API Key 是否有效
 */
import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/linear/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API Key is required' },
        { status: 400 }
      )
    }

    const user = await validateApiKey(apiKey)

    if (user) {
      return NextResponse.json({
        valid: true,
        user,
      })
    } else {
      return NextResponse.json({
        valid: false,
        error: 'Invalid API Key',
      })
    }
  } catch (error) {
    console.error('Error validating Linear API Key:', error)
    return NextResponse.json(
      { error: 'Failed to validate API Key' },
      { status: 500 }
    )
  }
}
