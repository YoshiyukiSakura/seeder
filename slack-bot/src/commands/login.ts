/**
 * /seeder-login Slash Command
 * 生成一次性登录链接并发送给用户
 */

import { App } from '@slack/bolt'
import { generateLoginToken } from '../lib/token'

export function registerLoginCommand(app: App) {
  app.command('/seeder-login', async ({ command, ack, respond }) => {
    // 立即确认收到命令
    await ack()

    const { user_id, user_name, team_id } = command

    try {
      // 生成登录 Token
      const token = await generateLoginToken({
        slackUserId: user_id,
        slackUsername: user_name,
        slackTeamId: team_id,
      })

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'
      const loginUrl = `${webUrl}/auth?token=${token}`

      // 发送私密消息（仅发送者可见）
      await respond({
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Seeder Login*\n\nHi ${user_name}! Click the button below to log in to Seeder.`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Open Seeder', emoji: true },
                url: loginUrl,
                style: 'primary',
              },
            ],
          },
        ],
      })
    } catch (error) {
      console.error('Login command error:', error)

      await respond({
        response_type: 'ephemeral',
        text: `Failed to generate login link. Please try again later.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  })
}
