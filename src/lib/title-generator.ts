/**
 * Plan Title Generator
 * 使用 DeepSeek API 从对话内容生成简短标题
 */

import { getDeepSeekClient } from './deepseek'
import { prisma } from './prisma'

const TITLE_PROMPT = `你是一个技术项目经理。请根据以下软件开发计划的对话内容，生成一个简短的标题。

要求：
1. 长度在 15-30 个字符之间
2. 简洁地描述计划的核心内容
3. 使用与对话相同的语言（如果对话是中文就用中文，英文就用英文）
4. 不要使用 markdown 格式
5. 不要使用引号包裹
6. 直接输出标题文本

对话内容：
{conversation}

标题：`

/**
 * 为指定 Plan 生成标题
 */
export async function generatePlanTitle(planId: string): Promise<string> {
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

  // 截断过长的对话（标题不需要完整上下文）
  const maxLength = 4000
  const truncatedText = conversationText.length > maxLength
    ? conversationText.slice(0, maxLength) + '\n\n[... 对话已截断]'
    : conversationText

  const prompt = TITLE_PROMPT.replace('{conversation}', truncatedText)

  const client = getDeepSeekClient()
  const title = await client.generateContent(prompt)

  // 清理生成结果
  return cleanTitle(title)
}

/**
 * 清理标题：移除引号、限制长度
 */
function cleanTitle(title: string): string {
  let cleaned = title.trim()

  // 移除首尾引号（单引号、双引号、中文引号）
  cleaned = cleaned.replace(/^["'「『""'']+|["'」』""'']+$/g, '')

  // 限制长度（最大 50 字符，以防万一）
  if (cleaned.length > 50) {
    cleaned = cleaned.slice(0, 47) + '...'
  }

  return cleaned
}
