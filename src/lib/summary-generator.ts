/**
 * Plan Summary Generator
 * 使用 DeepSeek API 从对话内容生成简洁的计划摘要
 */

import { getDeepSeekClient } from './deepseek'
import { prisma } from './prisma'

const SUMMARY_PROMPT = `你是一个技术项目经理。请根据以下软件开发计划的对话内容，生成一个简洁的摘要。

要求：
1. 最多 2-3 句话
2. 聚焦于要实现的主要功能或变更
3. 如有必要，提及关键的技术方面
4. 使用与对话相同的语言（如果对话是中文就用中文，英文就用英文）
5. 不要使用 markdown 格式，直接输出纯文本

对话内容：
{conversation}

摘要：`

/**
 * 为指定 Plan 生成摘要
 */
export async function generatePlanSummary(planId: string): Promise<string> {
  // 获取 Plan 的所有对话记录
  const conversations = await prisma.conversation.findMany({
    where: { planId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true }
  })

  if (conversations.length === 0) {
    throw new Error('No conversations found for plan')
  }

  // 格式化对话内容
  const conversationText = conversations
    .map((c) => `${c.role.toUpperCase()}: ${c.content}`)
    .join('\n\n')

  // 截断过长的对话（避免超出 token 限制）
  const maxLength = 8000
  const truncatedText = conversationText.length > maxLength
    ? conversationText.slice(0, maxLength) + '\n\n[... 对话已截断]'
    : conversationText

  const prompt = SUMMARY_PROMPT.replace('{conversation}', truncatedText)

  const client = getDeepSeekClient()
  const summary = await client.generateContent(prompt)

  return summary.trim()
}
