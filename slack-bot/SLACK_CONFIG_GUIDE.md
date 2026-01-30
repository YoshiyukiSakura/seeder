# Slack App 配置指南

本指南说明如何在 Slack API 平台配置 Bot Token Scopes、事件订阅和 Socket Mode。

## 前置条件

1. 访问 https://api.slack.com/apps
2. 登录你的 Slack 账户
3. 选择现有的 App 或创建新的 App

## 1. 配置 Bot Token Scopes

### 步骤：
1. 在左侧菜单点击 **OAuth & Permissions**
2. 找到 **Bot Token Scopes** 部分
3. 添加以下权限：
   - `app_mentions:read` - 读取 @mention 消息
   - `chat:write` - 发送消息
   - `channels:read` - 读取频道信息
   - `channels:manage` - 管理频道（可选，用于创建频道）
   - `channels:history` - 查看频道历史消息

4. 点击 **Save Changes**

## 2. 启用 Socket Mode

### 步骤：
1. 在左侧菜单点击 **Socket Mode**
2. 启用 **Enable Socket Mode** 开关
3. 如果需要命名 App Token，可以输入名称（如 `seedbed-bot`）
4. 点击 **Enable Socket Mode** 确认

## 3. 配置事件订阅

### 步骤：
1. 在左侧菜单点击 **Event Subscriptions**
2. 启用 **Enable Events** 开关
3. 展开 **Subscribe to bot events** 部分
4. 添加以下事件：
   - `app_mention` - 当 Bot 被 @mention 时触发
   - `message.channels` - 当频道有新消息时触发（可选）
5. 点击 **Save Changes**

## 4. 重新安装 App 到 Workspace

### 步骤：
1. 在左侧菜单点击 **Install App**
2. 点击 **Reinstall App** 按钮
3. 确认权限请求
4. 点击 **Allow** 授权

## 5. 获取 App Credentials

### App Token (connections:write 权限)：
1. 在左侧菜单点击 **Socket Mode**
2. 复制 **App Token**（格式：`xapp-...`）
3. 添加到环境变量 `SLACK_APP_TOKEN`

### Bot Token (用户 OAuth Token)：
1. 在左侧菜单点击 **OAuth & Permissions**
2. 复制 **Bot User OAuth Token**（格式：`xoxb-...`）
3. 添加到环境变量 `SLACK_BOT_TOKEN`

### Signing Secret：
1. 在左侧菜单点击 **Basic Information**
2. 向下滚动到 **App Credentials** 部分
3. 复制 **Signing Secret**
4. 添加到环境变量 `SLACK_SIGNING_SECRET`

## 6. 配置环境变量

复制 `.env.example` 为 `.env` 并填入值：

```bash
cp slack-bot/.env.example slack-bot/.env
```

编辑 `.env` 文件：

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret
WEB_URL=http://localhost:3000
PORT=3001
BOT_SECRET=seedbed-bot-secret
```

## 7. 启动 Bot

```bash
cd slack-bot
npm install
npm run dev
```

## 验证配置

1. 在 Slack 中@mention 你的 Bot
2. Bot 应该回复：`Hi <@user>! I'm the Seedbed Bot. Use /seedbed-login to get started.`

## 常见问题

### Q: Socket Mode 有什么优势？
A: Socket Mode 通过 WebSocket 连接，无需公网访问，适合本地开发和内部使用。

### Q: 需要重新安装 App 吗？
A:是的，每当修改 Bot Token Scopes 后都需要重新安装 App。

### Q: 事件订阅回调地址怎么配置？
A:Socket Mode 不需要公网回调地址，连接由 Bot 主动发起。