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
      input?: Record<string, unknown>  // 支持所有工具的参数
    }>
  }
  result?: string
  session_id?: string  // Claude CLI 返回的会话 ID
  tools?: string[]
}

/**
 * 根据工具名称和参数生成可读的摘要
 */
function generateToolSummary(name: string, input: Record<string, unknown>): string {
  const truncate = (s: string, max: number) =>
    s.length > max ? s.slice(0, max) + '...' : s

  const getFileName = (path: string) =>
    path.split('/').slice(-2).join('/')

  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'NotebookEdit':
      return input.file_path ? getFileName(input.file_path as string) : ''

    case 'Grep':
      return input.pattern ? `"${truncate(input.pattern as string, 30)}"` : ''

    case 'Glob':
      return input.pattern ? truncate(input.pattern as string, 40) : ''

    case 'Bash':
      const cmd = (input.command as string) || ''
      return truncate(cmd, 50)

    case 'WebSearch':
      return input.query ? `"${truncate(input.query as string, 30)}"` : ''

    case 'WebFetch':
      try {
        return input.url ? new URL(input.url as string).hostname : ''
      } catch {
        return truncate((input.url as string) || '', 30)
      }

    case 'LSP':
      return `${input.operation || ''} @ L${input.line || '?'}`

    case 'TodoWrite':
      const todos = input.todos as unknown[]
      return `${todos?.length || 0} items`

    case 'Task':
      return input.description ? truncate(input.description as string, 40) : ''

    case 'AskUserQuestion':
      const questions = input.questions as unknown[]
      return `${questions?.length || 0} questions`

    default:
      // 尝试提取第一个有意义的字符串参数
      for (const key of Object.keys(input)) {
        const val = input[key]
        if (typeof val === 'string' && val.length > 0 && val.length < 60) {
          return truncate(val, 40)
        }
      }
      return ''
  }
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
                const questions = (content.input?.questions || []) as Array<{
                  question: string
                  header?: string
                  options?: Array<{ label: string; description?: string }>
                  multiSelect?: boolean
                }>
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
                const toolName = content.name || 'unknown'
                const toolInput = content.input || {}
                return {
                  type: 'tool',
                  data: {
                    name: toolName,
                    id: content.id || `tool_${Date.now()}`,
                    summary: generateToolSummary(toolName, toolInput),
                    timestamp: Date.now()
                  }
                }
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
