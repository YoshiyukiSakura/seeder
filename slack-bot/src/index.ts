/**
 * Seedbed Slack Bot
 * 提供用户认证入口
 */

import 'dotenv/config'
import { App } from '@slack/bolt'
import { registerLoginCommand } from './commands/login'

// 验证必需的环境变量
const requiredEnvVars = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'WEB_URL']
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`)
    process.exit(1)
  }
}

// 初始化 Slack App
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  // 使用 Socket Mode 开发时可以设置
  // socketMode: true,
  // appToken: process.env.SLACK_APP_TOKEN,
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

// 启动应用
const PORT = Number(process.env.PORT) || 3001

;(async () => {
  await app.start(PORT)
  console.log(`Seedbed Slack Bot is running on port ${PORT}`)
  console.log(`Web URL: ${process.env.WEB_URL}`)
})()
