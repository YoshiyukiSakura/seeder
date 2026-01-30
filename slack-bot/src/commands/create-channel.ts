/**
 * /seeder-create-channel Slash Command
 * 为项目创建 Slack 频道
 */

import { App } from '@slack/bolt'

interface CreateChannelResponse {
  success: boolean
  channelId?: string
  channelName?: string
  message?: string
  error?: string
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
 * 解析命令参数
 * 格式: /seeder-create-channel <projectId>
 */
export function parseCommandParams(text: string): { projectId: string | null; error?: string } {
  const trimmed = text.trim()

  if (!trimmed) {
    return { projectId: null, error: 'Missing project ID' }
  }

  // projectId 通常是 UUID 格式或项目标识符
  return { projectId: trimmed }
}

export function registerCreateChannelCommand(app: App) {
  app.command('/seeder-create-channel', async ({ command, ack, respond }) => {
    // 立即确认收到命令
    await ack()

    const { text, user_id, user_name } = command

    // 解析参数
    const { projectId, error: parseError } = parseCommandParams(text)

    if (parseError) {
      await respond({
        response_type: 'ephemeral',
        text: `Error: ${parseError}\n\nUsage: /seeder-create-channel <projectId>`,
      })
      return
    }

    try {
      // 调用后端 API
      const result = await createChannel(projectId!)

      if (result.success && result.channelId && result.channelName) {
        // 频道已存在或创建成功
        const isExisting = result.message === 'Channel already exists'

        await respond({
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Create Slack Channel*`,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Status:*\n${isExisting ? 'Channel already exists' : 'Created successfully'}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Channel:*\n#${result.channelName}`,
                },
              ],
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Project ID: \`${projectId}\``,
                },
              ],
            },
          ],
        })
      } else {
        // 创建失败
        await respond({
          response_type: 'ephemeral',
          text: `Failed to create channel: ${result.error || 'Unknown error'}`,
        })
      }
    } catch (error) {
      console.error('Create channel command error:', error)

      await respond({
        response_type: 'ephemeral',
        text: `An error occurred while creating the channel.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  })
}