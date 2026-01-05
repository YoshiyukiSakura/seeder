/**
 * /api/plans/[planId]/conversations
 * GET - 获取计划的对话历史
 * POST - 添加对话消息（单条或批量）
 * DELETE - 清空对话历史
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import type { Prisma } from '@/generated/prisma/client'

interface RouteParams {
  params: Promise<{ planId: string }>
}

interface ConversationInput {
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Prisma.InputJsonValue
}

// GET /api/plans/[planId]/conversations
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await params

  try {
    // 验证计划存在
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const conversations = await prisma.conversation.findMany({
      where: { planId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Get conversations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/plans/[planId]/conversations
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await params

  try {
    // 验证计划存在
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const body = await request.json()

    // 支持单条消息或批量消息
    const messagesInput: ConversationInput[] = Array.isArray(body.messages)
      ? body.messages
      : [body]

    const conversations = await Promise.all(
      messagesInput.map(async (msg) => {
        return prisma.conversation.create({
          data: {
            planId,
            role: msg.role,
            content: msg.content,
            metadata: msg.metadata ?? undefined,
          },
        })
      })
    )

    // 返回单条或数组，取决于输入格式
    const result = Array.isArray(body.messages) ? conversations : conversations[0]
    return NextResponse.json({ conversation: result }, { status: 201 })
  } catch (error) {
    console.error('Create conversation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/plans/[planId]/conversations
// 清空计划的所有对话（用于重新开始对话）
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await params

  try {
    // 验证计划存在
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    await prisma.conversation.deleteMany({
      where: { planId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete conversations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
