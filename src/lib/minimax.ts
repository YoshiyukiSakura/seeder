/**
 * MiniMax API Client
 * OpenAI 兼容格式，用于任务提取
 */

export class MiniMaxClient {
  private apiKey: string
  private model: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string, model = 'MiniMaxAI/MiniMax-M2.1') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.model = model
  }

  /**
   * 调用 MiniMax API 生成内容
   */
  async generateContent(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`

    const request = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,  // 低温度，保证结构化输出的稳定性
      max_tokens: 8192
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`MiniMax API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    const choice = data.choices?.[0]
    if (!choice) {
      throw new Error('No choices in MiniMax response')
    }

    const content = choice.message?.content
    if (!content) {
      throw new Error('No content in MiniMax response')
    }

    return content
  }
}

// 单例实例
let minimaxClient: MiniMaxClient | null = null

export function getMiniMaxClient(): MiniMaxClient {
  if (!minimaxClient) {
    const apiKey = process.env.MINIMAX_API_KEY
    const baseUrl = process.env.MINIMAX_BASE_URL
    if (!apiKey) {
      throw new Error('MINIMAX_API_KEY environment variable is not set')
    }
    if (!baseUrl) {
      throw new Error('MINIMAX_BASE_URL environment variable is not set')
    }
    minimaxClient = new MiniMaxClient(apiKey, baseUrl)
  }
  return minimaxClient
}
