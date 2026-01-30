/**
 * Seedbed Slack Bot
 * 提供用户认证入口
 */

import 'dotenv/config'
import { App } from '@slack/bolt'
import { registerLoginCommand } from './commands/login'
import { registerCreateChannelCommand } from './commands/create-channel'
import { registerLinkChannelCommand } from './commands/link-channel'
import { registerAppMentionListener } from './listeners/app-mention'
import { registerThreadMessageListener } from './listeners/thread-message'
import { registerConversationHandlers } from './services/conversation-manager'

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
registerCreateChannelCommand(app)
registerLinkChannelCommand(app)

// 注册事件监听器
registerAppMentionListener(app)
registerThreadMessageListener(app)

// 注册对话相关的处理器（问题卡片交互）
registerConversationHandlers(app)

// 启动应用 (Socket Mode)
;(async () => {
  await app.start()
  console.log('Seedbed Slack Bot is running in Socket Mode')
  console.log(`Web URL: ${process.env.WEB_URL}`)
})()
