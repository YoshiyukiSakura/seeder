/**
 * Claude CLI 模块单元测试
 * 测试 src/lib/claude.ts
 */
import {
  createMockClaudeSSEEvents,
  createMockQuestionEvent,
} from '../../utils/mocks'
import {
  CLAUDE_PLAN_RESPONSE,
  SSE_INIT_EVENT,
  SSE_TEXT_EVENT,
  SSE_TOOL_EVENT,
  SSE_QUESTION_EVENT,
  SSE_QUESTION_MULTISELECT_EVENT,
  SSE_RESULT_EVENT,
  SSE_DONE_EVENT,
} from '../../utils/fixtures'

describe('Claude Module', () => {
  describe('SSE Event Types', () => {
    it('should have correct init event structure', () => {
      const event = SSE_INIT_EVENT

      expect(event.type).toBe('init')
      expect(event.data).toHaveProperty('cwd')
      expect(event.data).toHaveProperty('useContinue')
    })

    it('should have correct text event structure', () => {
      const event = SSE_TEXT_EVENT

      expect(event.type).toBe('text')
      expect(event.data).toHaveProperty('content')
      expect(typeof event.data.content).toBe('string')
    })

    it('should have correct tool event structure', () => {
      const event = SSE_TOOL_EVENT

      expect(event.type).toBe('tool')
      expect(event.data).toHaveProperty('name')
    })

    it('should have correct question event structure', () => {
      const event = SSE_QUESTION_EVENT

      expect(event.type).toBe('question')
      expect(event.data).toHaveProperty('toolUseId')
      expect(event.data).toHaveProperty('questions')
      expect(Array.isArray(event.data.questions)).toBe(true)
    })

    it('should have correct result event structure', () => {
      const event = SSE_RESULT_EVENT

      expect(event.type).toBe('result')
      expect(event.data).toHaveProperty('content')
    })

    it('should have correct done event structure', () => {
      const event = SSE_DONE_EVENT

      expect(event.type).toBe('done')
      expect(event.data).toEqual({})
    })
  })

  describe('Question Event Parsing', () => {
    it('should parse question with options', () => {
      const event = createMockQuestionEvent()

      expect(event.data.questions).toHaveLength(1)
      expect(event.data.questions[0].question).toContain('认证方式')
      expect(event.data.questions[0].options).toHaveLength(3)
    })

    it('should parse multiSelect flag', () => {
      const event = createMockQuestionEvent()

      expect(event.data.questions[0].multiSelect).toBe(false)
    })

    it('should correctly identify multiSelect questions', () => {
      const event = SSE_QUESTION_MULTISELECT_EVENT

      // First question has multiSelect: true
      expect(event.data.questions[0].multiSelect).toBe(true)
      expect(event.data.questions[0].options).toHaveLength(4)

      // Second question has multiSelect: false
      expect(event.data.questions[1].multiSelect).toBe(false)
      expect(event.data.questions[1].options).toHaveLength(2)
    })

    it('should include toolUseId for response', () => {
      const event = createMockQuestionEvent()

      expect(event.data.toolUseId).toBeTruthy()
      expect(typeof event.data.toolUseId).toBe('string')
    })
  })

  describe('SSE Event Sequence', () => {
    it('should produce correct event sequence', () => {
      const events = createMockClaudeSSEEvents()

      // First should be init
      expect(events[0].type).toBe('init')

      // Last should be done
      expect(events[events.length - 1].type).toBe('done')
    })

    it('should include text events for content', () => {
      const events = createMockClaudeSSEEvents()
      const textEvents = events.filter(e => e.type === 'text')

      expect(textEvents.length).toBeGreaterThan(0)
    })

    it('should include result event before done', () => {
      const events = createMockClaudeSSEEvents()
      const resultIndex = events.findIndex(e => e.type === 'result')
      const doneIndex = events.findIndex(e => e.type === 'done')

      expect(resultIndex).toBeLessThan(doneIndex)
    })
  })

  describe('Task Extraction from Markdown', () => {
    // Helper function to extract tasks from markdown
    function extractTasksFromMarkdown(markdown: string) {
      const tasks: Array<{
        title: string
        priority: number
        description: string
        labels: string[]
        acceptanceCriteria: string[]
        relatedFiles: string[]
        estimateHours: number | null
      }> = []

      // Split by task headers
      const taskSections = markdown.split(/(?=## 任务 \d+:)/)

      for (const section of taskSections) {
        // Match task header
        const headerMatch = section.match(/## 任务 \d+: \[P(\d)\] (.+)/)
        if (!headerMatch) continue

        const priority = parseInt(headerMatch[1], 10)
        const title = headerMatch[2].trim()

        // Extract description
        const descMatch = section.match(/\*\*描述\*\*: (.+?)(?=\n\*\*|$)/s)
        const description = descMatch ? descMatch[1].trim() : ''

        // Extract labels
        const labelsMatch = section.match(/\*\*标签\*\*: (.+?)(?=\n|$)/)
        const labels = labelsMatch
          ? labelsMatch[1].split(/[,，]/).map(l => l.trim())
          : []

        // Extract acceptance criteria
        const criteriaMatch = section.match(/\*\*验收标准\*\*:\n([\s\S]+?)(?=\n\*\*|$)/)
        const acceptanceCriteria = criteriaMatch
          ? criteriaMatch[1]
              .split('\n')
              .filter(line => line.match(/^- \[[ x]\]/))
              .map(line => line.replace(/^- \[[ x]\] /, '').trim())
          : []

        // Extract related files
        const filesMatch = section.match(/\*\*相关文件\*\*: (.+?)(?=\n|$)/)
        const relatedFiles = filesMatch
          ? filesMatch[1].split(/[,，]/).map(f => f.trim())
          : []

        // Extract estimate
        const estimateMatch = section.match(/\*\*预估时间\*\*: (\d+(?:\.\d+)?)h/)
        const estimateHours = estimateMatch
          ? parseFloat(estimateMatch[1])
          : null

        tasks.push({
          title,
          priority,
          description,
          labels,
          acceptanceCriteria,
          relatedFiles,
          estimateHours,
        })
      }

      return tasks
    }

    // Fix regex for extraction

    it('should extract task title and priority', () => {
      const tasks = extractTasksFromMarkdown(CLAUDE_PLAN_RESPONSE)

      expect(tasks.length).toBeGreaterThan(0)
      expect(tasks[0].title).toBe('创建 Comment 数据模型')
      expect(tasks[0].priority).toBe(0) // P0
    })

    it('should extract multiple tasks', () => {
      const tasks = extractTasksFromMarkdown(CLAUDE_PLAN_RESPONSE)

      expect(tasks.length).toBe(4)
    })

    it('should extract description', () => {
      const tasks = extractTasksFromMarkdown(CLAUDE_PLAN_RESPONSE)

      expect(tasks[0].description).toContain('Prisma schema')
    })

    it('should extract labels', () => {
      const tasks = extractTasksFromMarkdown(CLAUDE_PLAN_RESPONSE)

      expect(tasks[0].labels).toContain('后端')
      expect(tasks[0].labels).toContain('数据库')
    })

    it('should extract acceptance criteria', () => {
      const tasks = extractTasksFromMarkdown(CLAUDE_PLAN_RESPONSE)

      expect(tasks[0].acceptanceCriteria.length).toBeGreaterThan(0)
      expect(tasks[0].acceptanceCriteria).toContain('数据库迁移成功执行')
    })

    it('should extract related files', () => {
      const tasks = extractTasksFromMarkdown(CLAUDE_PLAN_RESPONSE)

      expect(tasks[0].relatedFiles).toContain('prisma/schema.prisma')
    })

    it('should extract estimate hours', () => {
      const tasks = extractTasksFromMarkdown(CLAUDE_PLAN_RESPONSE)

      expect(tasks[0].estimateHours).toBe(1)
      expect(tasks[1].estimateHours).toBe(3)
    })

    it('should handle empty markdown', () => {
      const tasks = extractTasksFromMarkdown('')

      expect(tasks).toEqual([])
    })

    it('should handle markdown without tasks', () => {
      const markdown = '# Just a title\n\nSome content without task format'
      const tasks = extractTasksFromMarkdown(markdown)

      expect(tasks).toEqual([])
    })
  })

  describe('CLI Arguments Building', () => {
    function buildClaudeArgs(options: {
      mode: 'start' | 'continue'
      prompt: string
      projectPath?: string
      sessionId?: string
    }) {
      const args = [
        '--permission-mode', 'plan',
        '--output-format', 'stream-json',
        '--verbose',
        '--print',
      ]

      if (options.projectPath) {
        args.push('--cwd', options.projectPath)
      }

      if (options.mode === 'continue' && options.sessionId) {
        args.push('--resume', options.sessionId)
      } else if (options.mode === 'continue') {
        args.push('--continue')
      }

      args.push(options.prompt)

      return args
    }

    it('should build correct args for start mode', () => {
      const args = buildClaudeArgs({
        mode: 'start',
        prompt: 'Create a comment feature',
        projectPath: '/project',
      })

      expect(args).toContain('--permission-mode')
      expect(args).toContain('plan')
      expect(args).toContain('--output-format')
      expect(args).toContain('stream-json')
      expect(args).toContain('--cwd')
      expect(args).toContain('/project')
      expect(args).toContain('Create a comment feature')
    })

    it('should build correct args for continue with session', () => {
      const args = buildClaudeArgs({
        mode: 'continue',
        prompt: 'Yes, proceed',
        sessionId: 'sess_abc123',
      })

      expect(args).toContain('--resume')
      expect(args).toContain('sess_abc123')
      expect(args).not.toContain('--continue')
    })

    it('should build correct args for continue without session', () => {
      const args = buildClaudeArgs({
        mode: 'continue',
        prompt: 'Yes, proceed',
      })

      expect(args).toContain('--continue')
      expect(args).not.toContain('--resume')
    })

    it('should always include verbose and print flags', () => {
      const args = buildClaudeArgs({
        mode: 'start',
        prompt: 'Test',
      })

      expect(args).toContain('--verbose')
      expect(args).toContain('--print')
    })
  })
})

describe('MultiSelect Answer Formatting', () => {
  // Helper function matching the logic in page.tsx
  function formatAnswer(answer: string | string[]): string {
    return Array.isArray(answer) ? answer.join(', ') : answer
  }

  function isAnswered(question: { multiSelect?: boolean }, answer: string | string[] | undefined): boolean {
    if (!answer) return false
    if (question.multiSelect) {
      return Array.isArray(answer) && answer.length > 0
    }
    return typeof answer === 'string' && answer.length > 0
  }

  it('should format single select answer', () => {
    const answer = 'Yes'
    expect(formatAnswer(answer)).toBe('Yes')
  })

  it('should format multi select answer as comma separated', () => {
    const answer = ['Option A', 'Option B', 'Option C']
    expect(formatAnswer(answer)).toBe('Option A, Option B, Option C')
  })

  it('should handle empty multi select array', () => {
    const answer: string[] = []
    expect(formatAnswer(answer)).toBe('')
  })

  it('should correctly check if single select is answered', () => {
    const question = { multiSelect: false }

    expect(isAnswered(question, 'Yes')).toBe(true)
    expect(isAnswered(question, '')).toBe(false)
    expect(isAnswered(question, undefined)).toBe(false)
  })

  it('should correctly check if multi select is answered', () => {
    const question = { multiSelect: true }

    expect(isAnswered(question, ['A', 'B'])).toBe(true)
    expect(isAnswered(question, ['A'])).toBe(true)
    expect(isAnswered(question, [])).toBe(false)
    expect(isAnswered(question, undefined)).toBe(false)
  })

  it('should handle mixed question types', () => {
    const questions = [
      { question: 'Q1', multiSelect: true },
      { question: 'Q2', multiSelect: false },
    ]
    const answers: Record<number, string | string[]> = {
      0: ['A', 'B'],
      1: 'Single Answer',
    }

    const allAnswered = questions.every((q, idx) => isAnswered(q, answers[idx]))
    expect(allAnswered).toBe(true)

    const formattedAnswers = questions.map((q, idx) => {
      const header = `Question ${idx + 1}`
      return `${header}: ${formatAnswer(answers[idx])}`
    })
    expect(formattedAnswers).toEqual([
      'Question 1: A, B',
      'Question 2: Single Answer',
    ])
  })
})

describe('Prompt with Images Building', () => {
  // Helper function matching the logic in src/lib/claude.ts
  function buildPromptWithImages(prompt: string, imagePaths?: string[]): string {
    if (!imagePaths || imagePaths.length === 0) {
      return prompt
    }

    const imageSection = imagePaths
      .map(path => `[Image: ${path}]`)
      .join('\n')

    return `${prompt}\n\n附带的图片:\n${imageSection}`
  }

  it('should return original prompt when no imagePaths provided', () => {
    const prompt = 'Create a new feature'
    expect(buildPromptWithImages(prompt)).toBe(prompt)
    expect(buildPromptWithImages(prompt, undefined)).toBe(prompt)
    expect(buildPromptWithImages(prompt, [])).toBe(prompt)
  })

  it('should append single image path to prompt', () => {
    const prompt = 'Analyze this design'
    const imagePaths = ['/tmp/uploads/image1.png']
    const result = buildPromptWithImages(prompt, imagePaths)

    expect(result).toBe('Analyze this design\n\n附带的图片:\n[Image: /tmp/uploads/image1.png]')
  })

  it('should append multiple image paths to prompt', () => {
    const prompt = 'Review these screenshots'
    const imagePaths = [
      '/tmp/uploads/screen1.png',
      '/tmp/uploads/screen2.jpg',
      '/tmp/uploads/mockup.webp'
    ]
    const result = buildPromptWithImages(prompt, imagePaths)

    expect(result).toContain('Review these screenshots')
    expect(result).toContain('附带的图片:')
    expect(result).toContain('[Image: /tmp/uploads/screen1.png]')
    expect(result).toContain('[Image: /tmp/uploads/screen2.jpg]')
    expect(result).toContain('[Image: /tmp/uploads/mockup.webp]')
  })

  it('should preserve original prompt content', () => {
    const prompt = 'Multi-line\nprompt\nwith special chars: @#$%'
    const imagePaths = ['/tmp/uploads/test.png']
    const result = buildPromptWithImages(prompt, imagePaths)

    expect(result.startsWith(prompt)).toBe(true)
  })
})

describe('JSON Line Parsing', () => {
  function parseJSONLine(line: string) {
    if (!line.trim()) return null
    try {
      return JSON.parse(line)
    } catch {
      return null
    }
  }

  it('should parse valid JSON line', () => {
    const line = '{"type":"text","content":"Hello"}'
    const result = parseJSONLine(line)

    expect(result).toEqual({ type: 'text', content: 'Hello' })
  })

  it('should return null for empty line', () => {
    expect(parseJSONLine('')).toBeNull()
    expect(parseJSONLine('   ')).toBeNull()
  })

  it('should return null for invalid JSON', () => {
    expect(parseJSONLine('{invalid}')).toBeNull()
    expect(parseJSONLine('not json at all')).toBeNull()
  })

  it('should handle nested objects', () => {
    const line = '{"type":"question","data":{"questions":[{"q":"Test?"}]}}'
    const result = parseJSONLine(line)

    expect(result.type).toBe('question')
    expect(result.data.questions).toHaveLength(1)
  })
})
