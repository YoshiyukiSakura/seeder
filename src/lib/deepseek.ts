/**
 * DeepSeek API Client
 * OpenAI 兼容格式，用于任务提取
 */

export class DeepSeekClient {
  private apiKey: string
  private model: string
  private baseUrl = 'https://api.deepseek.com/v1'

  constructor(apiKey: string, model = 'deepseek-chat') {
    this.apiKey = apiKey
    this.model = model
  }

  /**
   * 调用 DeepSeek API 生成内容
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
      throw new Error(`DeepSeek API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    const choice = data.choices?.[0]
    if (!choice) {
      throw new Error('No choices in DeepSeek response')
    }

    const content = choice.message?.content
    if (!content) {
      throw new Error('No content in DeepSeek response')
    }

    return content
  }
}

// 单例实例
let deepseekClient: DeepSeekClient | null = null

export function getDeepSeekClient(): DeepSeekClient {
  if (!deepseekClient) {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is not set')
    }
    deepseekClient = new DeepSeekClient(apiKey)
  }
  return deepseekClient
}
