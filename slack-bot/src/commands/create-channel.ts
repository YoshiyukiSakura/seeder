/**
 * /seeder-create-channel Slash Command
 * 为项目创建 Slack 频道，支持模糊匹配项目名称
 */

import { App } from '@slack/bolt'

interface Project {
  id: string
  name: string
  hasChannel: boolean
  channelName?: string
}

interface CreateChannelResponse {
  success: boolean
  channelId?: string
  channelName?: string
  message?: string
  error?: string
}

interface AIMatchResult {
  projectId: string | null
  projectName: string | null
  confidence: 'high' | 'low' | 'none'
  reason: string
}

const MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'http://localhost:8000/v1/chat/completions'
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''

/**
 * 获取所有项目列表
 */
async function listProjects(): Promise<Project[]> {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000'
  const botSecret = process.env.BOT_SECRET

  if (!botSecret) {
    throw new Error('BOT_SECRET not configured')
  }

  const response = await fetch(`${webUrl}/api/slack/search-projects`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': botSecret,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to list projects: ${response.status}`)
  }

  const data = await response.json()
  return data.projects || []
}

/**
 * 使用 AI 匹配用户输入的项目名称
 */
async function matchProjectWithAI(userInput: string, projects: Project[]): Promise<AIMatchResult> {
  if (projects.length === 0) {
    return {
      projectId: null,
      projectName: null,
      confidence: 'none',
      reason: 'No projects available',
    }
  }

  const projectList = projects.map((p, i) => `${i + 1}. "${p.name}" (id: ${p.id})`).join('\n')

  const prompt = `Match the user input "${userInput}" to the most appropriate project from this list:\n${projectList}`

  const tools = [
    {
      type: 'function',
      function: {
        name: 'match_project',
        description: 'Match user input to a project from the list',
        parameters: {
          type: 'object',
          properties: {
            matchedIndex: {
              type: 'integer',
              description: `Project number (1-${projects.length}) that best matches the user input, or null if no match`,
              minimum: 1,
              maximum: projects.length,
            },
            confidence: {
              type: 'string',
              enum: ['high', 'low', 'none'],
              description: 'high=clear match, low=ambiguous, none=no match',
            },
            reason: {
              type: 'string',
              description: 'Brief reason for the match (max 10 words)',
            },
          },
          required: ['confidence', 'reason'],
        },
      },
    },
  ]

  try {
    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'MiniMaxAI/MiniMax-M2.1',
        messages: [{ role: 'user', content: prompt }],
        tools,
        tool_choice: { type: 'function', function: { name: 'match_project' } },
        stream: false,
        max_tokens: 512,
      }),
    })

    if (!response.ok) {
      console.error('AI API error:', response.status)
      return fallbackMatch(userInput, projects)
    }

    const data = await response.json()
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]

    if (!toolCall || toolCall.function?.name !== 'match_project') {
      console.error('No tool call in AI response:', JSON.stringify(data))
      return fallbackMatch(userInput, projects)
    }

    // 移除 <think>...</think> 标签后解析 JSON
    let args = toolCall.function.arguments || ''
    args = args.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    const jsonMatch = args.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Failed to parse tool arguments:', args)
      return fallbackMatch(userInput, projects)
    }
    const result = JSON.parse(jsonMatch[0])
    const matchedIndex = result.matchedIndex

    if (matchedIndex && matchedIndex >= 1 && matchedIndex <= projects.length) {
      const project = projects[matchedIndex - 1]
      return {
        projectId: project.id,
        projectName: project.name,
        confidence: result.confidence || 'low',
        reason: result.reason || '',
      }
    }

    return {
      projectId: null,
      projectName: null,
      confidence: result.confidence || 'none',
      reason: result.reason || 'No match found',
    }
  } catch (error) {
    console.error('AI matching error:', error)
    return fallbackMatch(userInput, projects)
  }
}

/**
 * 简单的后备匹配（当 AI 不可用时）
 */
function fallbackMatch(userInput: string, projects: Project[]): AIMatchResult {
  const input = userInput.toLowerCase().trim()

  // 精确匹配
  const exactMatch = projects.find((p) => p.name.toLowerCase() === input)
  if (exactMatch) {
    return {
      projectId: exactMatch.id,
      projectName: exactMatch.name,
      confidence: 'high',
      reason: 'Exact match',
    }
  }

  // 包含匹配
  const containsMatches = projects.filter((p) => p.name.toLowerCase().includes(input) || input.includes(p.name.toLowerCase()))

  if (containsMatches.length === 1) {
    return {
      projectId: containsMatches[0].id,
      projectName: containsMatches[0].name,
      confidence: 'high',
      reason: 'Partial match',
    }
  }

  if (containsMatches.length > 1) {
    return {
      projectId: null,
      projectName: null,
      confidence: 'low',
      reason: `Multiple matches: ${containsMatches.map((p) => p.name).join(', ')}`,
    }
  }

  return {
    projectId: null,
    projectName: null,
    confidence: 'none',
    reason: 'No match found',
  }
}

/**
 * 调用后端 API 创建 Slack 频道
 */
async function createChannel(projectId: string): Promise<CreateChannelResponse> {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000'
  const botSecret = process.env.BOT_SECRET

  if (!botSecret) {
    return { success: false, error: 'BOT_SECRET not configured on server' }
  }

  const response = await fetch(`${webUrl}/api/slack/create-channel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': botSecret,
    },
    body: JSON.stringify({ projectId }),
  })

  const data = await response.json()

  if (!response.ok) {
    return {
      success: false,
      error: data.error || `HTTP ${response.status}: Failed to create channel`,
    }
  }

  return data as CreateChannelResponse
}

/**
 * 格式化项目列表为 Slack 消息
 */
function formatProjectList(projects: Project[]): string {
  if (projects.length === 0) {
    return 'No projects found.'
  }

  return projects
    .map((p, i) => {
      const channelInfo = p.hasChannel ? ` → #${p.channelName}` : ''
      return `${i + 1}. *${p.name}*${channelInfo}`
    })
    .join('\n')
}

export function registerCreateChannelCommand(app: App) {
  app.command('/seeder-create-channel', async ({ command, ack, respond }) => {
    await ack()

    const { text } = command
    const userInput = text.trim()

    // 如果没有输入，显示所有项目列表
    if (!userInput) {
      try {
        const projects = await listProjects()
        await respond({
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Available Projects:*\n\n' + formatProjectList(projects),
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'Usage: `/seeder-create-channel <project name>`\nExample: `/seeder-create-channel my-project`',
                },
              ],
            },
          ],
        })
      } catch (error) {
        await respond({
          response_type: 'ephemeral',
          text: `Error listing projects: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
      return
    }

    try {
      // 获取项目列表
      const projects = await listProjects()

      if (projects.length === 0) {
        await respond({
          response_type: 'ephemeral',
          text: 'No projects found. Please create a project first.',
        })
        return
      }

      // 用 AI 匹配项目
      const matchResult = await matchProjectWithAI(userInput, projects)

      if (matchResult.confidence === 'none') {
        // 没有匹配，显示项目列表
        await respond({
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `❌ Could not find a project matching "*${userInput}*"\n\n*Available Projects:*\n${formatProjectList(projects)}`,
              },
            },
          ],
        })
        return
      }

      if (matchResult.confidence === 'low') {
        // 不确定的匹配，请用户确认
        await respond({
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `⚠️ Found possible match: *${matchResult.projectName}*\n_${matchResult.reason}_`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: `Yes, use "${matchResult.projectName}"`,
                    emoji: true,
                  },
                  style: 'primary',
                  value: matchResult.projectId!,
                  action_id: 'confirm_create_channel',
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Cancel',
                    emoji: true,
                  },
                  value: 'cancel',
                  action_id: 'cancel_create_channel',
                },
              ],
            },
          ],
        })
        return
      }

      // 高置信度匹配，直接创建
      const result = await createChannel(matchResult.projectId!)

      if (result.success && result.channelId && result.channelName) {
        const isExisting = result.message === 'Channel already exists'

        await respond({
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `✅ *${isExisting ? 'Channel Already Exists' : 'Channel Created'}*`,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Project:*\n${matchResult.projectName}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Channel:*\n<#${result.channelId}>`,
                },
              ],
            },
          ],
        })
      } else {
        await respond({
          response_type: 'ephemeral',
          text: `❌ Failed to create channel: ${result.error || 'Unknown error'}`,
        })
      }
    } catch (error) {
      console.error('Create channel command error:', error)
      await respond({
        response_type: 'ephemeral',
        text: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  })

  // 处理确认按钮点击
  app.action('confirm_create_channel', async ({ action, ack, respond }) => {
    await ack()

    const projectId = (action as { value: string }).value

    try {
      const result = await createChannel(projectId)

      if (result.success && result.channelId && result.channelName) {
        const isExisting = result.message === 'Channel already exists'

        await respond({
          response_type: 'ephemeral',
          replace_original: true,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `✅ *${isExisting ? 'Channel Already Exists' : 'Channel Created'}*\n\nChannel: <#${result.channelId}>`,
              },
            },
          ],
        })
      } else {
        await respond({
          response_type: 'ephemeral',
          replace_original: true,
          text: `❌ Failed to create channel: ${result.error || 'Unknown error'}`,
        })
      }
    } catch (error) {
      await respond({
        response_type: 'ephemeral',
        replace_original: true,
        text: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  })

  // 处理取消按钮点击
  app.action('cancel_create_channel', async ({ ack, respond }) => {
    await ack()
    await respond({
      response_type: 'ephemeral',
      replace_original: true,
      text: 'Cancelled.',
    })
  })
}

// 导出供测试使用
export { matchProjectWithAI, fallbackMatch, formatProjectList }
