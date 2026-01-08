/**
 * Seedbed Slack Bot
 * 提供用户认证入口
 */

import 'dotenv/config'
import { App } from '@slack/bolt'
import { registerLoginCommand } from './commands/login'

// 验证必需的环境变量
const requiredEnvVars = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'WEB_URL']
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`)
    process.exit(1)
  }
}

// 初始化 Slack App (Socket Mode)
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
})

// 注册命令
registerLoginCommand(app)

// 健康检查端点
app.event('app_mention', async ({ event, say }) => {
  await say({
    text: `Hi <@${event.user}>! I'm the Seedbed Bot. Use \`/seedbed-login\` to get started.`,
    thread_ts: event.ts,
  })
})

// 启动应用 (Socket Mode)
;(async () => {
  await app.start()
  console.log('Seedbed Slack Bot is running in Socket Mode')
  console.log(`Web URL: ${process.env.WEB_URL}`)
})()
