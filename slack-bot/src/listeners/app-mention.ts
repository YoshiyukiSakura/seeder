/**
 * App Mention Listener
 * 监听 app_mention 事件，处理用户 @ 提及并启动对话
 */

import { App, SayFn } from '@slack/bolt'
import { startConversation } from '../services/conversation-manager'
import { getProjectByChannel } from '../utils/api'

/**
 * 提取 bot user ID
 */
function extractBotUserId(eventText: string): string | null {
  // 匹配 <@Uxxx> 格式的 mentions
  const match = eventText.match(/<@([A-Z0-9]+)>/)
  return match ? match[1] : null
}

/**
 * 提取 prompt（移除 @Bot 标识）
 */
function extractPrompt(eventText: string): string {
  // 移除所有 <@BotId> 部分
  const cleanedText = eventText.replace(/<@[A-Z0-9]+>\s*/g, '')
  return cleanedText.trim()
}

/**
 * 发送错误消息到 Slack
 */
async function sendErrorMessage(say: SayFn, threadTs: string | undefined, message: string, recoverable: boolean = false): Promise<void> {
  const blocks: { type: string; text?: { type: string; text: string }; elements?: unknown[] }[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error:* ${message}`,
      },
    },
  ]

  if (recoverable) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'You can try again or mention me with a different request.',
        },
      ],
    })
  }

  await say({
    text: `Error: ${message}`,
    blocks,
    thread_ts: threadTs,
  })
}

/**
 * 发送占位消息并启动流式回复
 */
async function sendPlaceholderAndStart(say: SayFn, threadTs: string | undefined, userId: string): Promise<void> {
  // 发送占位消息
  await say({
    text: `Hi <@${userId}>! Let me think about that...`,
    thread_ts: threadTs,
  })
}

/**
 * 注册 app_mention 事件监听器
 */
export function registerAppMentionListener(app: App): void {
  app.event('app_mention', async ({ event, say, client }) => {
    const { text, channel, ts, user } = event
    const userId = user || 'someone'

    // 提取 prompt
    const prompt = extractPrompt(text)

    // 如果没有 prompt，仅问候
    if (!prompt) {
      await say({
        text: `Hi <@${userId}>! I'm the Seedbed Bot. Mention me with a request to start a conversation. Use \`/seedbed-login\` to get started.`,
        thread_ts: ts,
      })
      return
    }

    try {
      // 调用频道映射 API 获取 projectId
      const projectData = await getProjectByChannel(channel)

      if (!projectData) {
        await sendErrorMessage(
          say,
          ts,
          'No project is linked to this channel. Please ask an admin to link this channel to a project first.',
          false
        )
        return
      }

      // 获取频道名称
      let channelName: string | undefined
      try {
        const channelInfo = await client.conversations.info({ channel })
        channelName = channelInfo.channel?.name
      } catch (e) {
        console.warn('Failed to get channel name:', e)
      }

      // 启动对话
      await startConversation({
        prompt,
        projectId: projectData.projectId,
        projectPath: projectData.projectPath,  // 使用正确的 projectPath
        say,
        client,
        channelId: channel,
        threadTs: ts,
        slackChannelName: channelName,
      })
    } catch (error) {
      console.error('Error handling app_mention:', error)
      await sendErrorMessage(
        say,
        ts,
        error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
        true
      )
    }
  })
}

// 导出工具函数供测试使用
export { extractBotUserId, extractPrompt, sendPlaceholderAndStart }