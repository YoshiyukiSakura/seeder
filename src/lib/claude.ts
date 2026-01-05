import { spawn } from 'child_process'

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
  tools?: string[]
}

export interface SSEEvent {
  type: 'init' | 'text' | 'question' | 'tool' | 'result' | 'error' | 'done'
  data: unknown
}

export function runClaude(
  prompt: string,
  cwd: string,
  useContinue: boolean = false
): AsyncIterable<SSEEvent> {
  const args = [
    '--permission-mode', 'plan',
    '--output-format', 'stream-json',
    '--verbose',
    '--print',
  ]

  if (useContinue) {
    args.push('--continue')
  }

  args.push(prompt)

  const claude = spawn('claude', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd,
  })

  claude.stdin.end()

  return {
    async *[Symbol.asyncIterator]() {
      let buffer = ''

      yield { type: 'init', data: { cwd, useContinue } }

      const processLine = (line: string): SSEEvent | null => {
        if (!line.trim()) return null

        try {
          const msg: ClaudeMessage = JSON.parse(line)

          if (msg.type === 'system' && msg.subtype === 'init') {
            return { type: 'init', data: { tools: msg.tools?.length || 0 } }
          }

          if (msg.type === 'assistant' && msg.message?.content) {
            for (const content of msg.message.content) {
              if (content.type === 'tool_use' && content.name === 'AskUserQuestion') {
                const questions = content.input?.questions || []
                return {
                  type: 'question',
                  data: {
                    toolUseId: content.id,
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
                return { type: 'tool', data: { name: content.name } }
              }

              if (content.type === 'text' && content.text) {
                return { type: 'text', data: { content: content.text } }
              }
            }
          }

          if (msg.type === 'result' && msg.subtype === 'success') {
            return { type: 'result', data: { content: msg.result } }
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

      yield { type: 'done', data: {} }
    }
  }
}
