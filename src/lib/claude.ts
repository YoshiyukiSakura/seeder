import { spawn } from 'child_process'
import {
  type AnySSEEvent,
  createSSEError,
} from './sse-types'

export interface ClaudeMessage {
  type: 'system' | 'assistant' | 'user' | 'result'
  subtype?: string
  message?: {
    role: string
    content: Array<{
      type: string
      text?: string
      name?: string
      id?: string
      input?: {
        questions?: Array<{
          question: string
          header?: string
          options?: Array<{ label: string; description?: string }>
          multiSelect?: boolean
        }>
      }
    }>
  }
  result?: string
  session_id?: string  // Claude CLI 返回的会话 ID
  tools?: string[]
}

export interface RunClaudeOptions {
  prompt: string
  cwd: string
  sessionId?: string  // 用于 --resume 恢复特定会话
}

export function runClaude(
  options: RunClaudeOptions
): AsyncIterable<AnySSEEvent> {
  const { prompt, cwd, sessionId } = options

  const args = [
    '--permission-mode', 'plan',
    '--output-format', 'stream-json',
    '--verbose',
    '--print',
  ]

  // 使用 --resume <sessionId> 恢复特定会话，比 --continue 更精确安全
  if (sessionId) {
    args.push('--resume', sessionId)
  }

  args.push(prompt)

  const claude = spawn('claude', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd,
  })

  claude.stdin.end()

  // 收集 stderr 错误信息
  let stderrBuffer = ''
  claude.stderr.on('data', (data) => {
    stderrBuffer += data.toString()
  })

  return {
    async *[Symbol.asyncIterator]() {
      let buffer = ''
      let hasError = false

      yield { type: 'init', data: { cwd, resuming: !!sessionId } }

      const processLine = (line: string): AnySSEEvent | null => {
        if (!line.trim()) return null

        try {
          const msg: ClaudeMessage = JSON.parse(line)

          if (msg.type === 'system' && msg.subtype === 'init') {
            return { type: 'init', data: { cwd, tools: msg.tools?.length || 0 } }
          }

          if (msg.type === 'assistant' && msg.message?.content) {
            for (const content of msg.message.content) {
              if (content.type === 'tool_use' && content.name === 'AskUserQuestion') {
                const questions = content.input?.questions || []
                return {
                  type: 'question',
                  data: {
                    toolUseId: content.id || '',
                    questions: questions.map(q => ({
                      question: q.question,
                      header: q.header,
                      options: q.options,
                      multiSelect: q.multiSelect
                    }))
                  }
                }
              }

              if (content.type === 'tool_use') {
                return { type: 'tool', data: { name: content.name || 'unknown' } }
              }

              if (content.type === 'text' && content.text) {
                return { type: 'text', data: { content: content.text } }
              }
            }
          }

          if (msg.type === 'result' && msg.subtype === 'success') {
            return {
              type: 'result',
              data: {
                content: msg.result || '',
                sessionId: msg.session_id  // 提取并返回 session_id
              }
            }
          }

          // 处理 result 错误
          if (msg.type === 'result' && msg.subtype === 'error') {
            hasError = true
            return createSSEError(
              msg.result || 'Unknown error occurred',
              'claude_error',
              { recoverable: false }
            )
          }

          return null
        } catch {
          return null
        }
      }

      for await (const chunk of claude.stdout) {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const event = processLine(line)
          if (event) yield event
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const event = processLine(buffer)
        if (event) yield event
      }

      // 检查是否有 session 相关错误
      if (stderrBuffer && !hasError) {
        const stderrTrimmed = stderrBuffer.trim()
        if (stderrTrimmed) {
          const isSessionError = stderrTrimmed.includes('session') ||
                                 stderrTrimmed.includes('not found') ||
                                 stderrTrimmed.includes('expired')

          yield createSSEError(
            stderrTrimmed,
            isSessionError ? 'session_error' : 'process_error',
            { recoverable: isSessionError }
          )
        }
      }

      yield { type: 'done', data: {} }
    }
  }
}
