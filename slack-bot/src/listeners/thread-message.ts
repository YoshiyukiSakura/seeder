/**
 * Thread Message Listener
 * 监听 Thread 内用户消息，根据 Thread 映射获取 planId 并继续对话
 */

import { App, SayFn } from '@slack/bolt'
import { continueConversation } from '../services/conversation-manager'
import { getPlanByThread } from '../utils/api'

/**
 * 发送占位消息并启动流式回复
 */
async function sendPlaceholderAndStart(say: SayFn, threadTs: string | undefined, userId: string): Promise<void> {
  await say({
    text: `Hi <@${userId}>! Let me think about that...`,
    thread_ts: threadTs,
  })
}

/**
 * 检查消息是否为 Bot 消息
 */
function isBotMessage(event: { bot_id?: string; subtype?: string }): boolean {
  // 直接标记为 bot 消息
  if (event.bot_id) return true
  // 传统 bot 消息子类型
  if (event.subtype === 'bot_message') return true
  return false
}

/**
 * 注册 message 事件监听器（处理 Thread 内消息）
 */
export function registerThreadMessageListener(app: App): void {
  app.event('message', async ({ event, say, client }) => {
    // 类型断言获取完整消息属性
    const message = event as {
      ts: string
      thread_ts?: string
      user?: string
      bot_id?: string
      subtype?: string
      channel: string
      text: string
    }

    // 1. 排除 Bot 消息
    if (isBotMessage(message)) {
      return
    }

    // 2. 检查是否为 Thread 内消息（非顶层消息）
    // message.thread_ts 存在且不等于消息本身的 ts，表示这是回复消息
    if (!message.thread_ts || message.thread_ts === message.ts) {
      return
    }

    // 3. 验证必需字段
    if (!message.user || !message.channel) {
      return
    }

    // 4. 调用 Thread 映射 API 获取 planId
    try {
      const planData = await getPlanByThread(message.channel, message.thread_ts)

      // 如果没有找到 plan，说明不是 Seeder 的 Thread，直接忽略
      if (!planData) {
        return
      }

      // 5. 发送占位消息并启动流式回复
      await sendPlaceholderAndStart(say, message.thread_ts, message.user)

      // 6. 继续对话
      await continueConversation({
        answer: message.text,
        projectPath: planData.projectPath,  // 使用正确的 projectPath
        sessionId: planData.sessionId,
        planId: planData.planId,
        say,
        client,
        channelId: message.channel,
        threadTs: message.thread_ts,
      })
    } catch (error) {
      console.error('Error handling thread message:', error)

      // 检查是否是 session 未就绪的错误
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('503') || errorMessage.includes('Session not ready')) {
        await say({
          text: `Hi <@${message.user}>, the conversation is still initializing. Please wait a moment and try again.`,
          thread_ts: message.thread_ts,
        })
        return
      }

      await say({
        text: `Sorry <@${message.user}>, something went wrong. Please try again.`,
        thread_ts: message.thread_ts,
      })
    }
  })
}

// 导出工具函数供测试使用
export { isBotMessage }