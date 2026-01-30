/**
 * Conversation Manager
 * 处理 Slack 对话管理，包括 SSE 事件流处理、消息更新、问题卡片显示等
 */

import { App, SayFn, BlockAction } from '@slack/bolt'
import { WebClient } from '@slack/web-api'
import type {
  SendToSeedbedOptions,
  ResumeConversationOptions,
  SeedbedCallbacks,
  SSEErrorData,
  SSETextEventData,
  SSEQuestionEventData,
  PlanCreatedEventData,
} from './seedbed-api'
import { sendToSeedbed, resumeConversation } from './seedbed-api'
import { getWebUrlForPlan, getWebUrlForPlanWithMessage, SLACK_MESSAGE_LIMIT } from '../utils/config'
import { getPlanByThread } from '../utils/api'

// 重新导出供外部使用
export { getWebUrlForPlan, getWebUrlForPlanWithMessage }

// Block Kit 类型
type BlockKitBlock = {
  type: string
  [key: string]: unknown
}

// Slack 消息更新累积计数器阈值
const MESSAGE_UPDATE_THRESHOLD = 5

// Slack 显示摘要的字符限制（超过此限制截断并显示 web 链接）
const SLACK_SUMMARY_LIMIT = 500

/**
 * 发送错误消息到 Slack
 */
async function sendErrorMessage(say: SayFn, threadTs: string | undefined, error: SSEErrorData): Promise<void> {
  const errorText = `*Error:* ${error.message}`
  const blocks: BlockKitBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: errorText,
      },
    },
  ]

  // 如果错误可恢复，添加帮助信息
  if (error.recoverable) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'You can try again or start a new conversation.',
        },
      ],
    })
  }

  await say({
    text: errorText,
    blocks,
    thread_ts: threadTs,
  } as { text: string; blocks: BlockKitBlock[]; thread_ts?: string })
}

/**
 * 创建问题卡片 Block Kit
 */
export function createQuestionBlocks(
  data: SSEQuestionEventData,
  questionIndex: number
): BlockKitBlock[] {
  const question = data.questions[questionIndex]
  if (!question) {
    return []
  }

  const blocks: BlockKitBlock[] = [
    {
      type: 'divider',
    },
  ]

  if (question.header) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${question.header}*`,
      },
    })
  }

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: question.question,
    },
  })

  if (question.options && question.options.length > 0) {
    // 创建选项元素 - 每个按钮使用不同的 action_id
    const optionElements: unknown[] = question.options.map((option, idx) => ({
      type: 'button',
      text: {
        type: 'plain_text',
        text: option.label,
        emoji: true,
      },
      value: option.label,  // 直接使用选项标签作为 value
      action_id: `question_option_${data.toolUseId}_${questionIndex}_${idx}`,
    }))

    // 添加输入框作为备选方案
    blocks.push({
      type: 'input',
      block_id: `question_input_block_${data.toolUseId}_${questionIndex}`,
      element: {
        type: 'plain_text_input',
        action_id: `question_input_${data.toolUseId}_${questionIndex}`,
        placeholder: {
          type: 'plain_text',
          text: 'Type your answer...',
        },
      },
      label: {
        type: 'plain_text',
        text: 'Your answer',
      },
      optional: true,
    })

    blocks.push({
      type: 'actions',
      elements: [
        ...optionElements,
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Submit',
            emoji: true,
          },
          style: 'primary',
          value: `submit_${data.toolUseId}_${questionIndex}`,
          action_id: `question_submit_${data.toolUseId}_${questionIndex}`,
        },
      ],
    })
  }

  return blocks
}

/**
 * 对话管理器接口
 */
export interface ConversationManager {
  say: SayFn
  client: WebClient
  channelId: string
  threadTs: string | undefined
  accumulatedText: string
  updateCount: number
  planId: string | null
  currentMessageTs: string | null
}

/**
 * 创建对话管理器
 */
export function createConversationManager(
  say: SayFn,
  client: WebClient,
  channelId: string,
  threadTs: string | undefined
): ConversationManager {
  return {
    say,
    client,
    channelId,
    threadTs,
    accumulatedText: '',
    updateCount: 0,
    planId: null,
    currentMessageTs: null,
  }
}

/**
 * 找到合适的分割点（尽量在换行处分割，避免截断单词）
 */
function findSplitPoint(text: string, maxLength: number): number {
  if (text.length <= maxLength) {
    return text.length
  }

  // 优先在换行符处分割
  const lastNewline = text.lastIndexOf('\n', maxLength)
  if (lastNewline > maxLength * 0.5) {
    return lastNewline + 1  // 包含换行符
  }

  // 其次在空格处分割
  const lastSpace = text.lastIndexOf(' ', maxLength)
  if (lastSpace > maxLength * 0.7) {
    return lastSpace + 1
  }

  // 最后直接截断
  return maxLength
}

/**
 * 将 git pull 输出简化为摘要
 * 避免在 Slack 中显示完整的文件列表
 */
function summarizeGitOutput(message: string): string {
  // 检查是否已经是最新
  if (message.includes('Already up to date')) {
    return '已是最新'
  }

  // 匹配 "X files changed, Y insertions(+), Z deletions(-)"
  const statsMatch = message.match(/(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/)
  if (statsMatch) {
    const files = statsMatch[1]
    const insertions = statsMatch[2] ? `+${Number(statsMatch[2]).toLocaleString()}` : ''
    const deletions = statsMatch[3] ? `-${Number(statsMatch[3]).toLocaleString()}` : ''
    const changes = [insertions, deletions].filter(Boolean).join('/')
    return `更新了 ${files} 个文件${changes ? ` (${changes} 行)` : ''}`
  }

  // 如果没有匹配到统计信息，只返回第一行（通常是分支信息或简短状态）
  const firstLine = message.split('\n')[0]?.trim()
  if (firstLine && firstLine.length < 100) {
    return firstLine
  }

  return 'Changes synced'
}

/**
 * 截断文本并添加 web 链接
 * 用于在 Slack 中显示摘要，完整内容可在 web 查看
 */
function truncateWithLink(text: string, limit: number, webUrl: string | null): string {
  if (text.length <= limit) {
    return text
  }

  // 找到合适的截断点
  const truncated = text.slice(0, limit)
  const lastNewline = truncated.lastIndexOf('\n')
  const cutPoint = lastNewline > limit * 0.6 ? lastNewline : limit

  const suffix = webUrl
    ? `\n\n... 查看完整回复: ${webUrl}`
    : '\n\n...'

  return text.slice(0, cutPoint) + suffix
}

/**
 * 流式更新 Slack 消息，带摘要限制
 * 使用 chat.update 实现流式输出，超过限制时显示截断版本
 */
async function updateMessageWithLimit(
  manager: ConversationManager,
  force: boolean = false
): Promise<void> {
  if (!manager.accumulatedText) {
    return
  }

  manager.updateCount++

  // 每 5 次累积或强制更新时发送/更新消息
  if (manager.updateCount >= MESSAGE_UPDATE_THRESHOLD || force) {
    try {
      // 计算要显示的内容（限制长度）
      let displayText: string
      if (manager.accumulatedText.length > SLACK_SUMMARY_LIMIT) {
        // 超过限制，显示截断版本 + 提示
        const truncated = manager.accumulatedText.slice(0, SLACK_SUMMARY_LIMIT)
        const lastNewline = truncated.lastIndexOf('\n')
        const cutPoint = lastNewline > SLACK_SUMMARY_LIMIT * 0.6 ? lastNewline : SLACK_SUMMARY_LIMIT
        displayText = manager.accumulatedText.slice(0, cutPoint) + '\n\n_...处理中，完整内容请查看 web_'
      } else {
        displayText = manager.accumulatedText
      }

      if (manager.currentMessageTs) {
        // 更新已有消息
        try {
          await manager.client.chat.update({
            channel: manager.channelId,
            ts: manager.currentMessageTs,
            text: displayText,
          })
        } catch (updateError) {
          // 更新失败，改为发送新消息
          console.warn('Failed to update message, posting new:', updateError)
          const result = await manager.client.chat.postMessage({
            channel: manager.channelId,
            thread_ts: manager.threadTs,
            text: displayText,
          })
          manager.currentMessageTs = result.ts || null
        }
      } else {
        // 发送新消息并保存 ts
        const result = await manager.client.chat.postMessage({
          channel: manager.channelId,
          thread_ts: manager.threadTs,
          text: displayText,
        })
        manager.currentMessageTs = result.ts || null
      }
    } catch (error) {
      console.error('Failed to update message:', error)
    }
    manager.updateCount = 0
  }
}

/**
 * 获取 SSE 回调函数
 */
export function getConversationCallbacks(
  manager: ConversationManager
): SeedbedCallbacks {
  return {
    onInit: async (data) => {
      // 不再发送初始化消息，直接开始累积文本
      // 用户已经知道他们发起了对话，无需额外提示
    },

    onText: async (content) => {
      // 累积文本
      manager.accumulatedText += content

      // 流式更新 Slack 消息，但限制显示长度
      const forceUpdate = content.endsWith('\n')
      await updateMessageWithLimit(manager, forceUpdate)
    },

    onQuestion: async (data) => {
      // 先发送累积的文本
      await updateMessageWithLimit(manager, true)

      // 为每个问题发送问题卡片（支持多问题）
      for (let i = 0; i < data.questions.length; i++) {
        const question = data.questions[i]
        if (question) {
          const blocks = createQuestionBlocks(data, i)
          await manager.say({
            text: question.question,
            blocks,
            thread_ts: manager.threadTs,
          })
        }
      }
    },

    onTool: async (data) => {
      // 不发送工具使用通知，减少 Slack 消息噪音
      // 工具调用详情可在 web 查看
    },

    onResult: async (data) => {
      // 更新 planId（如果有）
      if (data.planId) {
        manager.planId = data.planId
      }

      // 累积结果内容并更新显示
      if (data.content) {
        manager.accumulatedText += data.content
        await updateMessageWithLimit(manager, true)
      }
    },

    onError: async (error) => {
      // 发送累积的文本
      await updateMessageWithLimit(manager, true)

      // 发送错误消息
      await sendErrorMessage(manager.say, manager.threadTs, error)
    },

    onDone: async (data) => {
      // 对话结束时，更新消息为最终版本（带 web 链接）
      const webUrl = manager.planId ? getWebUrlForPlan(manager.planId) : null

      if (manager.accumulatedText && manager.currentMessageTs) {
        // 更新现有消息为最终摘要（带 web 链接）
        const summary = truncateWithLink(manager.accumulatedText, SLACK_SUMMARY_LIMIT, webUrl)
        try {
          await manager.client.chat.update({
            channel: manager.channelId,
            ts: manager.currentMessageTs,
            text: summary,
          })
        } catch (error) {
          console.warn('Failed to update final message:', error)
          // 发送新消息作为回退
          await manager.say({
            text: summary,
            thread_ts: manager.threadTs,
          })
        }
      } else if (manager.accumulatedText) {
        // 没有现有消息，发送新消息
        const summary = truncateWithLink(manager.accumulatedText, SLACK_SUMMARY_LIMIT, webUrl)
        await manager.say({
          text: summary,
          thread_ts: manager.threadTs,
        })
      } else if (webUrl) {
        // 没有文本内容，只发送完成消息和链接
        await manager.say({
          text: `任务完成。查看详情: ${webUrl}`,
          thread_ts: manager.threadTs,
        })
      }
    },

    onGitSync: async (data) => {
      // 发送累积的文本
      await updateMessageWithLimit(manager, true)

      // 发送 Git 同步状态
      let statusText: string
      if (data.success) {
        const summary = summarizeGitOutput(data.message || '')
        statusText = `Git sync: ${summary}`
      } else {
        statusText = `Git sync failed: ${data.error || 'Unknown error'}`
      }

      await manager.say({
        text: statusText,
        thread_ts: manager.threadTs,
      })
    },

    onPlanCreated: async (data) => {
      // 先发送累积的文本
      await updateMessageWithLimit(manager, true)

      // 保存 planId
      manager.planId = data.planId

      // 发送计划创建消息和链接
      const webUrl = getWebUrlForPlan(data.planId)
      await manager.say({
        text: `Plan created. View on web: ${webUrl}`,
        thread_ts: manager.threadTs,
      })
    },
  }
}

/**
 * 开始新对话
 */
export async function startConversation(
  options: Omit<SendToSeedbedOptions, 'callbacks' | 'slackThreadTs' | 'slackChannelId'> & {
    say: SayFn
    client: WebClient
    channelId: string
    threadTs?: string
    signal?: AbortSignal
  }
): Promise<void> {
  const { say, client, channelId, threadTs, ...restOptions } = options

  const manager = createConversationManager(say, client, channelId, threadTs)
  const callbacks = getConversationCallbacks(manager)

  await sendToSeedbed({
    ...restOptions,
    slackThreadTs: threadTs,
    slackChannelId: channelId,
    callbacks,
    signal: options.signal,
  })
}

/**
 * 继续对话（回答问题）
 */
export async function continueConversation(
  options: Omit<ResumeConversationOptions, 'callbacks'> & {
    say: SayFn
    client: WebClient
    channelId: string
    threadTs?: string
    signal?: AbortSignal
  }
): Promise<void> {
  const { say, client, channelId, threadTs, ...restOptions } = options

  const manager = createConversationManager(say, client, channelId, threadTs)
  const callbacks = getConversationCallbacks(manager)

  await resumeConversation({
    ...restOptions,
    callbacks,
    signal: options.signal,
  })
}

/**
 * 在 Slack App 中注册对话相关的事件处理
 */
export function registerConversationHandlers(app: App): void {
  // 处理选项按钮点击 - 直接提交选项作为答案
  // 匹配格式: question_option_{toolUseId}_{questionIndex}_{optionIndex}
  app.action(/^question_option_([^_]+)_(\d+)_(\d+)$/, async ({ action, ack, body, client }) => {
    await ack()

    const buttonAction = action as { action_id: string; value: string }
    const bodyTyped = body as BlockAction

    // 获取上下文
    const channelId = bodyTyped.channel?.id
    const threadTs = bodyTyped.message?.thread_ts || bodyTyped.message?.ts

    if (!channelId || !threadTs) {
      console.error('Missing channelId or threadTs in action body')
      return
    }

    try {
      // 获取 Plan 信息
      const planData = await getPlanByThread(channelId, threadTs)
      if (!planData) {
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: 'Could not find conversation context. Please start a new conversation.',
        })
        return
      }

      // 直接使用 value（已设为选项标签）
      const answer = buttonAction.value

      // 调用 continueConversation
      await continueConversation({
        answer,
        projectPath: planData.projectPath,
        sessionId: planData.sessionId,
        planId: planData.planId,
        say: async (msg) => {
          const msgObj = typeof msg === 'string' ? { text: msg } : msg
          return await client.chat.postMessage({
            channel: channelId,
            ...msgObj,
          })
        },
        client,
        channelId,
        threadTs,
      })
    } catch (error) {
      console.error('Error handling question option click:', error)

      // 检查是否是 session 未就绪的错误
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('503') || errorMessage.includes('Session not ready')) {
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: 'The conversation is still initializing. Please wait a moment and try again.',
        })
        return
      }

      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: 'An error occurred while processing your answer. Please try again.',
      })
    }
  })

  // 处理提交按钮 - 使用输入框内容
  app.action(/^question_submit_([^_]+)_(\d+)$/, async ({ action, ack, body, client }) => {
    await ack()

    const buttonAction = action as { action_id: string; value: string }
    const bodyTyped = body as BlockAction

    // 提取 toolUseId 和 questionIndex
    const match = buttonAction.action_id.match(/^question_submit_([^_]+)_(\d+)$/)
    if (!match) return

    const [, toolUseId, questionIndex] = match
    const channelId = bodyTyped.channel?.id
    const threadTs = bodyTyped.message?.thread_ts || bodyTyped.message?.ts

    if (!channelId || !threadTs) {
      console.error('Missing channelId or threadTs in action body')
      return
    }

    // 获取输入框的值
    const blockId = `question_input_block_${toolUseId}_${questionIndex}`
    const actionId = `question_input_${toolUseId}_${questionIndex}`
    const inputValue = bodyTyped.state?.values?.[blockId]?.[actionId]?.value

    if (!inputValue) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: 'Please enter your answer or select an option above.',
      })
      return
    }

    try {
      // 获取 Plan 信息
      const planData = await getPlanByThread(channelId, threadTs)
      if (!planData) {
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: 'Could not find conversation context. Please start a new conversation.',
        })
        return
      }

      // 调用 continueConversation
      await continueConversation({
        answer: inputValue,
        projectPath: planData.projectPath,
        sessionId: planData.sessionId,
        planId: planData.planId,
        say: async (msg) => {
          const msgObj = typeof msg === 'string' ? { text: msg } : msg
          return await client.chat.postMessage({
            channel: channelId,
            ...msgObj,
          })
        },
        client,
        channelId,
        threadTs,
      })
    } catch (error) {
      console.error('Error handling question submit:', error)

      // 检查是否是 session 未就绪的错误
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('503') || errorMessage.includes('Session not ready')) {
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: 'The conversation is still initializing. Please wait a moment and try again.',
        })
        return
      }

      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: 'An error occurred while processing your answer. Please try again.',
      })
    }
  })
}