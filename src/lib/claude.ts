import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join, isAbsolute } from 'path'
import {
  type AnySSEEvent,
  createSSEError,
} from './sse-types'

// 优先使用 ~/.local/bin/claude（新版本支持更多功能），否则使用系统 PATH 中的 claude
function getClaudePath(): string {
  const localClaudePath = join(homedir(), '.local', 'bin', 'claude')
  if (existsSync(localClaudePath)) {
    return localClaudePath
  }
  return 'claude'
}

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

    case 'ExitPlanMode':
    case 'EnterPlanMode':
      return 'Plan mode'

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
  imagePaths?: string[]  // 图片路径数组，会被拼接到 prompt 中
}

/**
 * 构建包含图片路径的完整 prompt
 * 明确指示 Claude 使用 Read 工具读取图片
 */
function buildPromptWithImages(prompt: string, imagePaths?: string[]): string {
  if (!imagePaths || imagePaths.length === 0) {
    return prompt
  }

  // 将相对路径转换为绝对路径
  // 上传 API 返回的路径格式: /tmp/uploads/xxx.png (相对项目根目录，不是真正的系统绝对路径)
  const projectRoot = process.cwd()
  const absolutePaths = imagePaths.map(p => {
    // 如果路径已经以项目根目录开头，直接返回
    if (p.startsWith(projectRoot)) {
      return p
    }
    // 否则，将路径拼接到项目根目录
    // 处理以 / 开头的相对路径（如 /tmp/uploads/xxx.png）
    const relativePath = p.startsWith('/') ? p.slice(1) : p
    return join(projectRoot, relativePath)
  })

  // 明确指示 Claude 读取图片文件
  const imageInstructions = absolutePaths
    .map((path, idx) => `${idx + 1}. ${path}`)
    .join('\n')

  return `IMPORTANT: The user has uploaded image file(s). You MUST use the Read tool to view the image(s) before responding.

Image file path(s):
${imageInstructions}

User's question: ${prompt}`
}

// Plan mode system prompt - defines strict constraints for the planning phase
const PLAN_MODE_SYSTEM_PROMPT = `
==========================================================
⚠️ CRITICAL: YOU ARE IN PLAN-ONLY MODE ⚠️
==========================================================

You are a PLANNING ASSISTANT. Your ONLY job is to:
1. READ and UNDERSTAND the codebase
2. ASK clarifying questions
3. OUTPUT a structured implementation plan

🚫 ABSOLUTE PROHIBITIONS - VIOLATION IS UNACCEPTABLE:
- DO NOT create, write, or modify ANY files
- DO NOT execute ANY code or scripts
- DO NOT run npm/yarn/pnpm commands
- DO NOT run git commands that change state
- DO NOT run docker commands
- DO NOT deploy anything
- DO NOT run tests or builds
- DO NOT make ANY changes to the system

✅ ALLOWED OPERATIONS:
- Use Read tool to read files
- Use Glob tool to find files
- Use Grep tool to search code
- Use WebFetch/WebSearch to gather information
- Use AskUserQuestion to clarify requirements
- Output your analysis and plan as text

📋 YOUR OUTPUT MUST BE A PLAN:
After analysis, output a structured plan with:
1. Summary of what you found
2. Numbered implementation steps
3. List of files to modify
4. How to verify the changes

🚫 NEVER ASK FOR EXECUTION CONFIRMATION:
- DO NOT ask "是否执行？", "要开始实施吗？", "Should I proceed?", "Shall I implement this?" etc.
- DO NOT ask the user to confirm execution in ANY way
- Your job is ONLY to output the plan text, nothing more
- After outputting the plan, your work is DONE
- The user will decide what to do next on their own

YOU ARE NOT AN EXECUTOR. YOU ARE A PLANNER.
DO NOT DO THE WORK. PLAN THE WORK.

When you need to ask questions, use the AskUserQuestion tool - never write questions in text.
==========================================================
`

export function runClaude(
  options: RunClaudeOptions,
  signal?: AbortSignal  // 可选的中断信号
): AsyncIterable<AnySSEEvent> {
  const { prompt, cwd, sessionId, imagePaths } = options
  const finalPrompt = buildPromptWithImages(prompt, imagePaths)

  const args = [
    '--permission-mode', 'plan',
    '--dangerously-skip-permissions',
    // Disallow ALL state-changing tools in plan mode
    // Bash is disabled to prevent file creation via shell commands (cat >, echo >, cp, etc.)
    // Task is disabled to prevent spawning agents that can execute code
    // Plan mode uses Read, Glob, Grep, WebFetch, WebSearch for exploration
    '--disallowedTools', 'Write,Edit,NotebookEdit,Task,Bash',
    '--output-format', 'stream-json',
    '--verbose',
    '--print',
    '--append-system-prompt', PLAN_MODE_SYSTEM_PROMPT,
  ]

  // 使用 --resume <sessionId> 恢复特定会话
  if (sessionId) {
    args.push('--resume', sessionId)
  }

  args.push(finalPrompt)

  const claudePath = getClaudePath()
  const claude = spawn(claudePath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd,
  })

  // 监听 abort signal，在中断时终止 Claude 进程
  if (signal) {
    signal.addEventListener('abort', () => {
      if (!claude.killed) {
        claude.kill('SIGTERM')
      }
    }, { once: true })
  }

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
            // 从 init 消息中捕获 session_id（比 result 消息更早可用）
            return {
              type: 'init',
              data: {
                cwd,
                resuming: !!sessionId,  // 保持与第一个 init 事件一致
                tools: msg.tools?.length || 0,
                sessionId: msg.session_id  // 这是关键！
              }
            }
          }

          if (msg.type === 'assistant' && msg.message?.content) {
            // 优先查找 AskUserQuestion 工具调用（不管在数组中的位置）
            const askUserQuestion = msg.message.content.find(
              c => c.type === 'tool_use' && c.name === 'AskUserQuestion'
            )
            if (askUserQuestion) {
              const questions = (askUserQuestion.input?.questions || []) as Array<{
                question: string
                header?: string
                options?: Array<{ label: string; description?: string }>
                multiSelect?: boolean
              }>
              return {
                type: 'question',
                data: {
                  toolUseId: askUserQuestion.id || '',
                  questions: questions.map(q => ({
                    question: q.question,
                    header: q.header,
                    options: q.options,
                    multiSelect: q.multiSelect
                  }))
                }
              }
            }

            // 然后处理其他内容
            for (const content of msg.message.content) {
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

          // 处理所有 result 类型
          if (msg.type === 'result') {
            // 先处理错误类型
            if (msg.subtype === 'error') {
              hasError = true
              return createSSEError(
                msg.result || 'Unknown error occurred',
                'claude_error',
                { recoverable: false }
              )
            }

            // 处理成功类型（success 或 end_turn）
            if (msg.subtype === 'success' || msg.subtype === 'end_turn') {
              return {
                type: 'result',
                data: {
                  content: msg.result || '',
                  sessionId: msg.session_id  // 提取并返回 session_id
                }
              }
            }

            // 其他情况（未知 subtype），仍然尝试返回 result
            return {
              type: 'result',
              data: {
                content: msg.result || '',
                sessionId: msg.session_id || undefined
              }
            }
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
