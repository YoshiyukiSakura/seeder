/**
 * Claude Start API 集成测试
 * 测试 POST /api/claude/start 端点
 */
import {
  createMockUser,
  createMockProject,
  createMockPlan,
  mockPrisma,
} from '../../utils/mocks'
import {
  SSE_INIT_EVENT,
  SSE_TEXT_EVENT,
  SSE_TOOL_EVENT,
  SSE_QUESTION_EVENT,
  SSE_RESULT_EVENT,
  SSE_DONE_EVENT,
} from '../../utils/fixtures'

// Mock runClaude
const mockRunClaude = jest.fn()
jest.mock('@/lib/claude', () => ({
  runClaude: (...args: unknown[]) => mockRunClaude(...args),
}))

// Mock sse-types
jest.mock('@/lib/sse-types', () => ({
  createSSEError: (message: string, errorType: string, options?: { code?: string }) => ({
    type: 'error',
    data: { message, errorType, code: options?.code },
  }),
  encodeSSEEvent: (event: { type: string; data: unknown }) => `data: ${JSON.stringify(event)}\n\n`,
}))

import { POST } from '@/app/api/claude/start/route'

// Helper to create async iterable from array
function createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item
      }
    },
  }
}

// Helper to read SSE stream
async function readSSEStream(response: Response): Promise<string[]> {
  // For native Response with ReadableStream
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const events: string[] = []
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          events.push(line.slice(6))
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith('data: ')) {
      events.push(buffer.slice(6))
    }

    return events
  }

  // Fallback: try to read as text (for mocked responses)
  try {
    const text = await response.text()
    const events: string[] = []
    const lines = text.split('\n\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        events.push(line.slice(6))
      }
    }
    return events
  } catch {
    return []
  }
}

// Helper to parse SSE events
function parseSSEEvents(rawEvents: string[]): Array<{ type: string; data: unknown }> {
  return rawEvents.map(raw => {
    try {
      return JSON.parse(raw)
    } catch {
      return { type: 'parse_error', data: { raw } }
    }
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/claude/start', () => {
  describe('Request Validation', () => {
    it('should return error for invalid JSON body', async () => {
      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      expect(response.status).toBe(400)
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(parsed[0].type).toBe('error')
      expect((parsed[0].data as { message: string }).message).toContain('Invalid JSON')
    })

    it('should return error for missing prompt', async () => {
      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      expect(response.status).toBe(400)
      expect(parsed[0].type).toBe('error')
      expect((parsed[0].data as { message: string }).message).toContain('prompt is required')
      expect((parsed[0].data as { code?: string }).code).toBe('MISSING_PROMPT')
    })

    it('should accept valid request with prompt only', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'init', data: { cwd: '/test' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Hello' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(mockRunClaude).toHaveBeenCalled()
    })
  })

  describe('SSE Response Headers', () => {
    it('should return correct SSE headers', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)

      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      expect(response.headers.get('Connection')).toBe('keep-alive')
    })
  })

  describe('Claude Execution', () => {
    it('should call runClaude with correct options', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Create a todo app',
          projectPath: '/my/project',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockRunClaude).toHaveBeenCalledWith({
        prompt: 'Create a todo app',
        cwd: '/my/project',
        imagePaths: undefined,
      })
    })

    it('should use process.cwd() when projectPath not provided', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockRunClaude).toHaveBeenCalledWith({
        prompt: 'test',
        cwd: process.cwd(),
        imagePaths: undefined,
      })
    })

    it('should pass imagePaths to runClaude', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const imagePaths = ['/tmp/uploads/image1.jpg', '/tmp/uploads/image2.png']

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Analyze these images',
          imagePaths,
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockRunClaude).toHaveBeenCalledWith({
        prompt: 'Analyze these images',
        cwd: process.cwd(),
        imagePaths,
      })
    })
  })

  describe('Event Streaming', () => {
    it('should stream init event', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'init', data: { cwd: '/test/project', tools: 15, sessionId: 'session_123' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const initEvent = parsed.find(e => e.type === 'init')
      expect(initEvent).toBeDefined()
      expect((initEvent?.data as { cwd: string }).cwd).toBe('/test/project')
    })

    it('should stream text events', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Hello, ' } },
        { type: 'text', data: { content: 'World!' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const textEvents = parsed.filter(e => e.type === 'text')
      expect(textEvents).toHaveLength(2)
      expect((textEvents[0].data as { content: string }).content).toBe('Hello, ')
      expect((textEvents[1].data as { content: string }).content).toBe('World!')
    })

    it('should stream tool events', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'tool', data: { name: 'Read', id: 'tool_1', summary: 'src/app.ts' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const toolEvent = parsed.find(e => e.type === 'tool')
      expect(toolEvent).toBeDefined()
      expect((toolEvent?.data as { name: string }).name).toBe('Read')
    })

    it('should stream question events', async () => {
      const questionData = {
        toolUseId: 'tool_use_123',
        questions: [
          {
            question: 'Which framework?',
            header: 'Framework',
            options: [
              { label: 'React', description: 'React.js' },
              { label: 'Vue', description: 'Vue.js' },
            ],
            multiSelect: false,
          },
        ],
      }

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'question', data: questionData },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const questionEvent = parsed.find(e => e.type === 'question')
      expect(questionEvent).toBeDefined()
      expect((questionEvent?.data as { toolUseId: string }).toolUseId).toBe('tool_use_123')
      expect((questionEvent?.data as { questions: unknown[] }).questions).toHaveLength(1)
    })

    it('should stream result event', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'result', data: { content: 'Task completed', sessionId: 'session_abc' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const resultEvent = parsed.find(e => e.type === 'result')
      expect(resultEvent).toBeDefined()
      expect((resultEvent?.data as { sessionId: string }).sessionId).toBe('session_abc')
    })

    it('should stream done event at the end', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Hello' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const lastEvent = parsed[parsed.length - 1]
      expect(lastEvent.type).toBe('done')
    })
  })

  describe('Database Integration', () => {
    it('should create Plan when projectId is provided', async () => {
      const project = createMockProject({ id: 'proj_123' })
      const plan = createMockPlan({ id: 'plan_456', projectId: project.id })

      mockPrisma.project.findUnique.mockResolvedValue(project)
      mockPrisma.plan.create.mockResolvedValue(plan)
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Response' } },
        { type: 'result', data: { content: 'Done', sessionId: 'session_xyz' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Create feature X',
          projectId: 'proj_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'proj_123' },
      })

      expect(mockPrisma.plan.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj_123',
          name: expect.any(String),
          description: 'Create feature X',
          status: 'DRAFT',
        },
      })

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: {
          planId: plan.id,
          role: 'user',
          content: 'Create feature X',
        },
      })
    })

    it('should save assistant response to conversation', async () => {
      const project = createMockProject({ id: 'proj_123' })
      const plan = createMockPlan({ id: 'plan_456', projectId: project.id })

      mockPrisma.project.findUnique.mockResolvedValue(project)
      mockPrisma.plan.create.mockResolvedValue(plan)
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })
      mockPrisma.plan.update.mockResolvedValue(plan)

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Hello ' } },
        { type: 'text', data: { content: 'World' } },
        { type: 'result', data: { content: 'Done', sessionId: 'session_xyz' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
          projectId: 'proj_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      // Wait for stream to complete
      await readSSEStream(response)

      // Check if assistant message was saved
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planId: plan.id,
            role: 'assistant',
            content: 'Hello World',
          }),
        })
      )
    })

    it('should update Plan with sessionId', async () => {
      const project = createMockProject({ id: 'proj_123' })
      const plan = createMockPlan({ id: 'plan_456', projectId: project.id })

      mockPrisma.project.findUnique.mockResolvedValue(project)
      mockPrisma.plan.create.mockResolvedValue(plan)
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })
      mockPrisma.plan.update.mockResolvedValue(plan)

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'init', data: { sessionId: 'session_from_init' } },
        { type: 'text', data: { content: 'Response' } },
        { type: 'result', data: { content: 'Done', sessionId: 'session_from_result' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
          projectId: 'proj_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      await readSSEStream(response)

      // Should save sessionId from init event early
      expect(mockPrisma.plan.update).toHaveBeenCalled()
    })

    it('should not create Plan when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null)

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
          projectId: 'nonexistent_proj',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockPrisma.plan.create).not.toHaveBeenCalled()
    })

    it('should continue execution even if database operations fail', async () => {
      mockPrisma.project.findUnique.mockRejectedValue(new Error('DB error'))

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Response' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
          projectId: 'proj_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      // Should still get response despite DB error
      const textEvent = parsed.find(e => e.type === 'text')
      expect(textEvent).toBeDefined()
    })
  })

  describe('Result Event Enhancement', () => {
    it('should add planId to result event', async () => {
      const project = createMockProject({ id: 'proj_123' })
      const plan = createMockPlan({ id: 'plan_456', projectId: project.id })

      mockPrisma.project.findUnique.mockResolvedValue(project)
      mockPrisma.plan.create.mockResolvedValue(plan)
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'result', data: { content: 'Done', sessionId: 'session_xyz' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
          projectId: 'proj_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const resultEvent = parsed.find(e => e.type === 'result')
      expect(resultEvent).toBeDefined()
      expect((resultEvent?.data as { planId: string }).planId).toBe('plan_456')
    })
  })

  describe('Question Event Handling', () => {
    it('should save pendingQuestion when question event received', async () => {
      const project = createMockProject({ id: 'proj_123' })
      const plan = createMockPlan({ id: 'plan_456', projectId: project.id })

      mockPrisma.project.findUnique.mockResolvedValue(project)
      mockPrisma.plan.create.mockResolvedValue(plan)
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })
      mockPrisma.plan.update.mockResolvedValue(plan)

      const questionData = {
        toolUseId: 'tool_123',
        questions: [
          { question: 'Choose option?', header: 'Options', options: [], multiSelect: false },
        ],
      }

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Before question' } },
        { type: 'question', data: questionData },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
          projectId: 'proj_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      await readSSEStream(response)

      // Should save pendingQuestion
      expect(mockPrisma.plan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: plan.id },
          data: { pendingQuestion: questionData },
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle runClaude errors gracefully', async () => {
      mockRunClaude.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          throw new Error('Claude process failed')
        },
      })

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const errorEvent = parsed.find(e => e.type === 'error')
      expect(errorEvent).toBeDefined()
      expect((errorEvent?.data as { message: string }).message).toContain('Claude process failed')
    })

    it('should include recoverable flag in error events', async () => {
      mockRunClaude.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          throw new Error('Connection timeout')
        },
      })

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const errorEvent = parsed.find(e => e.type === 'error')
      expect(errorEvent).toBeDefined()
    })
  })

  describe('Image Path Handling', () => {
    it('should handle single image path', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Describe this image',
          imagePaths: ['/tmp/uploads/test.jpg'],
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockRunClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          imagePaths: ['/tmp/uploads/test.jpg'],
        })
      )
    })

    it('should handle multiple image paths', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const images = [
        '/tmp/uploads/img1.jpg',
        '/tmp/uploads/img2.png',
        '/tmp/uploads/img3.gif',
      ]

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Compare these images',
          imagePaths: images,
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockRunClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          imagePaths: images,
        })
      )
    })

    it('should handle empty image paths array', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Just text prompt',
          imagePaths: [],
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockRunClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          imagePaths: [],
        })
      )
    })
  })

  describe('Plan Name Truncation', () => {
    it('should truncate long prompts for plan name', async () => {
      const project = createMockProject({ id: 'proj_123' })
      const plan = createMockPlan({ id: 'plan_456', projectId: project.id })

      mockPrisma.project.findUnique.mockResolvedValue(project)
      mockPrisma.plan.create.mockResolvedValue(plan)
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const longPrompt = 'A'.repeat(100)

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: longPrompt,
          projectId: 'proj_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockPrisma.plan.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj_123',
          name: 'A'.repeat(50) + '...',
          description: longPrompt,
          status: 'DRAFT',
        },
      })
    })

    it('should not add ellipsis for short prompts', async () => {
      const project = createMockProject({ id: 'proj_123' })
      const plan = createMockPlan({ id: 'plan_456', projectId: project.id })

      mockPrisma.project.findUnique.mockResolvedValue(project)
      mockPrisma.plan.create.mockResolvedValue(plan)
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const shortPrompt = 'Short prompt'

      const request = new Request('http://localhost:3000/api/claude/start', {
        method: 'POST',
        body: JSON.stringify({
          prompt: shortPrompt,
          projectId: 'proj_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockPrisma.plan.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj_123',
          name: shortPrompt,
          description: shortPrompt,
          status: 'DRAFT',
        },
      })
    })
  })
})
