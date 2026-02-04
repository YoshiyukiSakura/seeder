import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// Kimi CLI 路径，优先使用 ~/.local/bin/kimi
function getKimiPath(): string {
  const localKimiPath = join(homedir(), '.local', 'bin', 'kimi')
  if (existsSync(localKimiPath)) {
    return localKimiPath
  }
  return 'kimi'
}

// Kimi 评审请求参数
export interface KimiReviewRequest {
  planContent: string        // 要评审的计划内容
  kimiSessionId: string      // Kimi 会话 ID
  cwd?: string               // 工作目录（可选）
}

// Kimi 流式事件类型
export type KimiSSEEvent =
  | { type: 'init'; data: { sessionId: string } }
  | { type: 'text'; data: { content: string } }
  | { type: 'tool'; data: { name: string; summary?: string } }
  | { type: 'result'; data: { content: string } }
  | { type: 'error'; data: { message: string } }
  | { type: 'done'; data: Record<string, never> }

// Kimi 评审结果结构
export interface KimiReviewResult {
  score: number              // 0-100 分数
  summary: string            // 评审总结
  concerns: string[]         // 关注点/问题
  suggestions: string[]      // 改进建议
  raw?: string               // 原始输出（用于调试）
}

// Content item 类型
interface ContentItem {
  type: string
  text?: string
  think?: string
  name?: string
  id?: string
  input?: Record<string, unknown>
}

// Kimi CLI 消息格式（stream-json 模式）
// 支持 Claude CLI 格式和 Kimi CLI 直接格式
interface KimiMessage {
  // Claude CLI 格式
  type?: 'system' | 'assistant' | 'user' | 'result'
  subtype?: string
  message?: {
    role: string
    content: Array<ContentItem>
  }
  result?: string
  session_id?: string

  // Kimi CLI 格式（直接输出）
  role?: string
  content?: Array<ContentItem>
}

// 评审 prompt 模板
const REVIEW_PROMPT_TEMPLATE = `You are an expert technical reviewer. Please review the following implementation plan and provide structured feedback.

## Plan to Review:
{PLAN_CONTENT}

## Review Instructions:
1. Evaluate the plan's completeness, feasibility, and technical soundness
2. Identify potential risks, missing considerations, or areas of concern
3. Suggest specific improvements or alternatives where applicable
4. Provide an overall score (0-100)

## Required Output Format (MUST be valid JSON):
\`\`\`json
{
  "score": <number 0-100>,
  "summary": "<brief overall assessment in 1-2 sentences>",
  "concerns": [
    "<concern 1>",
    "<concern 2>"
  ],
  "suggestions": [
    "<suggestion 1>",
    "<suggestion 2>"
  ]
}
\`\`\`

IMPORTANT: Your response MUST contain a JSON code block with the exact structure shown above.
`

/**
 * 从 Kimi 输出中解析 JSON 评审结果
 * 支持从 markdown 代码块中提取 JSON
 */
export function parseKimiReviewJson(output: string): KimiReviewResult | null {
  // 尝试从 ```json ... ``` 代码块中提取
  const jsonBlockMatch = output.match(/```json\s*([\s\S]*?)```/)
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim())
      return validateReviewResult(parsed, output)
    } catch {
      // 继续尝试其他方式
    }
  }

  // 尝试从 ``` ... ``` 代码块中提取
  const codeBlockMatch = output.match(/```\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim())
      return validateReviewResult(parsed, output)
    } catch {
      // 继续尝试其他方式
    }
  }

  // 尝试直接查找 JSON 对象
  const jsonMatch = output.match(/\{[\s\S]*"score"[\s\S]*"summary"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      return validateReviewResult(parsed, output)
    } catch {
      // 解析失败
    }
  }

  // 最后尝试：寻找任何有效的 JSON 对象
  const anyJsonMatch = output.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/)
  if (anyJsonMatch) {
    try {
      const parsed = JSON.parse(anyJsonMatch[0])
      if (typeof parsed.score === 'number') {
        return validateReviewResult(parsed, output)
      }
    } catch {
      // 解析失败
    }
  }

  return null
}

/**
 * 验证并规范化评审结果
 */
function validateReviewResult(parsed: Record<string, unknown>, rawOutput: string): KimiReviewResult {
  return {
    score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 50,
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'No summary provided',
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns.filter((c): c is string => typeof c === 'string') : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s): s is string => typeof s === 'string') : [],
    raw: rawOutput
  }
}

/**
 * 运行 Kimi 评审，返回 SSE 事件的异步迭代器
 */
export function runKimiReview(
  request: KimiReviewRequest,
  signal?: AbortSignal
): AsyncIterable<KimiSSEEvent> {
  const { planContent, kimiSessionId, cwd } = request

  // 构建评审 prompt
  const prompt = REVIEW_PROMPT_TEMPLATE.replace('{PLAN_CONTENT}', planContent)

  const args = [
    '--print',
    '--output-format', 'stream-json',
    '--session', kimiSessionId,
    '--yolo',  // 自动确认所有操作
    '-p', prompt
  ]

  const kimiPath = getKimiPath()
  const workDir = cwd || process.cwd()

  let kimi: ChildProcess

  return {
    async *[Symbol.asyncIterator]() {
      kimi = spawn(kimiPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: workDir,
      })

      // 监听 abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          if (kimi && !kimi.killed) {
            kimi.kill('SIGTERM')
          }
        }, { once: true })
      }

      kimi.stdin?.end()

      // 收集 stderr
      let stderrBuffer = ''
      kimi.stderr?.on('data', (data) => {
        stderrBuffer += data.toString()
      })

      let buffer = ''
      let hasError = false
      let hasResult = false  // 跟踪是否已发送 result 事件
      let fullOutput = ''  // 收集完整输出用于 JSON 解析

      yield { type: 'init', data: { sessionId: kimiSessionId } }

      const processLine = (line: string): KimiSSEEvent | null => {
        if (!line.trim()) return null

        try {
          const msg: KimiMessage = JSON.parse(line)

          // 处理 Kimi CLI 直接格式：{"role":"assistant","content":[...]}
          if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            for (const content of msg.content) {
              if (content.type === 'tool_use') {
                return {
                  type: 'tool',
                  data: {
                    name: content.name || 'unknown',
                    summary: content.input ? JSON.stringify(content.input).slice(0, 50) : undefined
                  }
                }
              }

              if (content.type === 'text' && content.text) {
                fullOutput += content.text
                return { type: 'text', data: { content: content.text } }
              }
            }
          }

          // 处理 Claude CLI 格式：{"type":"assistant","message":{...}}
          if (msg.type === 'assistant' && msg.message?.content) {
            for (const content of msg.message.content) {
              if (content.type === 'tool_use') {
                return {
                  type: 'tool',
                  data: {
                    name: content.name || 'unknown',
                    summary: content.input ? JSON.stringify(content.input).slice(0, 50) : undefined
                  }
                }
              }

              if (content.type === 'text' && content.text) {
                fullOutput += content.text
                return { type: 'text', data: { content: content.text } }
              }
            }
          }

          // 处理 result 事件
          if (msg.type === 'result') {
            if (msg.subtype === 'error') {
              hasError = true
              return {
                type: 'error',
                data: { message: msg.result || 'Unknown error' }
              }
            }

            if (msg.subtype === 'success' || msg.subtype === 'end_turn') {
              if (msg.result) {
                fullOutput += msg.result
              }
              hasResult = true
              return {
                type: 'result',
                data: { content: fullOutput }
              }
            }
          }

          return null
        } catch {
          return null
        }
      }

      try {
        for await (const chunk of kimi.stdout!) {
          buffer += chunk.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const event = processLine(line)
            if (event) yield event
          }
        }

        // 处理剩余 buffer
        if (buffer.trim()) {
          const event = processLine(buffer)
          if (event) yield event
        }

        // Kimi CLI 不发送 type: 'result' 消息
        // 流结束时，如果收集到了输出但没有发送过 result，主动发送 result 事件
        if (fullOutput && !hasError && !hasResult) {
          yield {
            type: 'result',
            data: { content: fullOutput }
          }
        }

        // 检查 stderr 错误
        if (stderrBuffer && !hasError) {
          const stderrTrimmed = stderrBuffer.trim()
          // 忽略一些常见的非错误输出
          if (stderrTrimmed && !stderrTrimmed.includes('Using model')) {
            yield {
              type: 'error',
              data: { message: stderrTrimmed }
            }
          }
        }

        yield { type: 'done', data: {} }
      } catch (err) {
        yield {
          type: 'error',
          data: { message: err instanceof Error ? err.message : 'Unknown error' }
        }
        yield { type: 'done', data: {} }
      }
    }
  }
}

/**
 * 同步运行 Kimi 评审，返回完整结果
 * 适用于不需要流式输出的场景
 */
export async function runKimiReviewSync(
  request: KimiReviewRequest,
  signal?: AbortSignal,
  timeoutMs: number = 120000  // 默认 2 分钟超时
): Promise<{ success: boolean; result?: KimiReviewResult; error?: string; raw?: string }> {
  let fullOutput = ''
  let errorMessage = ''

  // 创建超时 signal
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => {
    timeoutController.abort()
  }, timeoutMs)

  // 合并用户提供的 signal 和超时 signal
  const combinedSignal = signal
    ? new AbortController()
    : timeoutController

  if (signal) {
    signal.addEventListener('abort', () => {
      combinedSignal.abort()
    }, { once: true })
    timeoutController.signal.addEventListener('abort', () => {
      combinedSignal.abort()
    }, { once: true })
  }

  try {
    for await (const event of runKimiReview(request, combinedSignal.signal)) {
      switch (event.type) {
        case 'text':
          fullOutput += event.data.content
          break
        case 'result':
          fullOutput = event.data.content
          break
        case 'error':
          errorMessage = event.data.message
          break
      }
    }

    clearTimeout(timeout)

    if (errorMessage) {
      return { success: false, error: errorMessage, raw: fullOutput }
    }

    const result = parseKimiReviewJson(fullOutput)
    if (result) {
      return { success: true, result, raw: fullOutput }
    }

    return {
      success: false,
      error: 'Failed to parse review result as JSON',
      raw: fullOutput
    }
  } catch (err) {
    clearTimeout(timeout)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      raw: fullOutput
    }
  }
}
