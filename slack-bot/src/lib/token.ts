/**
 * Token 生成库
 * 调用主项目 API 生成一次性登录 Token
 */

interface GenerateTokenParams {
  slackUserId: string
  slackUsername: string
  slackTeamId?: string
}

interface TokenResponse {
  token: string
  expiresAt: string
}

export async function generateLoginToken(params: GenerateTokenParams): Promise<string> {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000'

  const response = await fetch(`${webUrl}/api/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 使用共享密钥验证请求来自 Bot
      'X-Bot-Secret': process.env.BOT_SECRET || 'seedbed-bot-secret',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to generate token: ${error}`)
  }

  const data = (await response.json()) as TokenResponse
  return data.token
}
