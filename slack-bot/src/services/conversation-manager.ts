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
 * 更新 Slack 消息（累积文本）
 * 使用 chat.update 更新已有消息，避免发送多条消息
 * 当消息过长时，分段发送多条消息，确保不丢失内容
 */
async function updateMessage(
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
      // 如果消息过长，需要分段发送（确保不丢失内容）
      while (manager.accumulatedText.length > SLACK_MESSAGE_LIMIT) {
        const splitPoint = findSplitPoint(manager.accumulatedText, SLACK_MESSAGE_LIMIT)
        const chunk = manager.accumulatedText.slice(0, splitPoint)
        manager.accumulatedText = manager.accumulatedText.slice(splitPoint)

        // 如果有当前消息且是第一个 chunk，更新它
        if (manager.currentMessageTs) {
          await manager.client.chat.update({
            channel: manager.channelId,
            ts: manager.currentMessageTs,
            text: chunk,
          })
          manager.currentMessageTs = null  // 后续 chunk 发送新消息
        } else {
          // 发送为新消息
          await manager.client.chat.postMessage({
            channel: manager.channelId,
            thread_ts: manager.threadTs,
            text: chunk,
          })
        }
      }

      // 处理剩余内容（小于限制）
      if (manager.accumulatedText) {
        if (manager.currentMessageTs) {
          // 更新已有消息
          await manager.client.chat.update({
            channel: manager.channelId,
            ts: manager.currentMessageTs,
            text: manager.accumulatedText,
          })
        } else {
          // 发送新消息并保存 ts
          const result = await manager.client.chat.postMessage({
            channel: manager.channelId,
            thread_ts: manager.threadTs,
            text: manager.accumulatedText,
          })
          manager.currentMessageTs = result.ts || null
        }
      }
    } catch (error) {
      console.error('Failed to update message:', error)
      // 回退到发送新消息
      await manager.say({
        text: manager.accumulatedText.slice(0, SLACK_MESSAGE_LIMIT),
        thread_ts: manager.threadTs,
      })
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
      // 发送初始化提示
      const initText = data.resuming
        ? 'Resuming conversation...'
        : 'Starting new conversation...'

      await manager.say({
        text: initText,
        thread_ts: manager.threadTs,
      })
    },

    onText: async (content) => {
      // 累积文本
      manager.accumulatedText += content

      // 检查是否需要立即发送（仅换行结尾时强制更新）
      // 注意：不使用空格作为条件，因为 LLM tokenization 导致大多数片段以空格结尾
      const forceUpdate = content.endsWith('\n')
      await updateMessage(manager, forceUpdate)
    },

    onQuestion: async (data) => {
      // 先发送累积的文本
      await updateMessage(manager, true)

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
      // 发送累积的文本
      await updateMessage(manager, true)

      // 发送工具使用提示
      const toolText = `*Using tool:* ${data.name}${data.summary ? ` - ${data.summary}` : ''}`
      await manager.say({
        text: toolText,
        thread_ts: manager.threadTs,
      })
    },

    onResult: async (data) => {
      // 发送累积的文本
      await updateMessage(manager, true)

      // 更新 planId（如果有）
      if (data.planId) {
        manager.planId = data.planId
      }

      // 发送结果
      if (data.content) {
        await manager.say({
          text: data.content,
          thread_ts: manager.threadTs,
        })
      }
    },

    onError: async (error) => {
      // 发送累积的文本
      await updateMessage(manager, true)

      // 发送错误消息
      await sendErrorMessage(manager.say, manager.threadTs, error)
    },

    onDone: async (data) => {
      // 发送累积的文本
      await updateMessage(manager, true)

      // 发送完成消息和链接
      if (manager.planId) {
        const webUrl = getWebUrlForPlan(manager.planId)
        await manager.say({
          text: `Conversation complete. View on web: ${webUrl}`,
          thread_ts: manager.threadTs,
        })
      } else {
        await manager.say({
          text: 'Conversation complete.',
          thread_ts: manager.threadTs,
        })
      }
    },

    onGitSync: async (data) => {
      // 发送累积的文本
      await updateMessage(manager, true)

      // 发送 Git 同步状态
      const statusText = data.success
        ? `Git sync: ${data.message || 'Changes synced'}`
        : `Git sync failed: ${data.error || 'Unknown error'}`

      await manager.say({
        text: statusText,
        thread_ts: manager.threadTs,
      })
    },

    onPlanCreated: async (data) => {
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