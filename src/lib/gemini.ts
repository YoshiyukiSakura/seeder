/**
 * Gemini API Client
 * 简化版客户端，用于任务提取
 */

export class GeminiClient {
  private apiKey: string
  private model: string
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta'

  constructor(apiKey: string, model = 'gemini-3-pro-preview') {
    this.apiKey = apiKey
    this.model = model
  }

  /**
   * 调用 Gemini API 生成内容
   */
  async generateContent(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`

    const request = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.1,  // 低温度，保证结构化输出的稳定性
        maxOutputTokens: 8192
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    const candidate = data.candidates?.[0]
    if (!candidate) {
      throw new Error('No candidates in Gemini response')
    }

    const parts = candidate.content?.parts || []
    const textParts = parts.filter((p: { text?: string }) => p.text)

    if (textParts.length === 0) {
      throw new Error('No text content in Gemini response')
    }

    return textParts.map((p: { text: string }) => p.text).join('')
  }
}

// 单例实例
let geminiClient: GeminiClient | null = null

export function getGeminiClient(): GeminiClient {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set')
    }
    geminiClient = new GeminiClient(apiKey)
  }
  return geminiClient
}
