/**
 * Claude Continue API 集成测试
 * 测试 POST /api/claude/continue 端点
 */
import {
  createMockUser,
  createMockProject,
  createMockPlan,
  mockPrisma,
} from '../../utils/mocks'

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

// Mock DbNull from prisma namespace
jest.mock('@/generated/prisma/internal/prismaNamespace', () => ({
  DbNull: Symbol('DbNull'),
}))

import { POST } from '@/app/api/claude/continue/route'

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

describe('POST /api/claude/continue', () => {
  describe('Request Validation', () => {
    it('should return error for invalid JSON body', async () => {
      const request = new Request('http://localhost:3000/api/claude/continue', {
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

    it('should return error for missing answer', async () => {
      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'session_123' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      expect(response.status).toBe(400)
      expect(parsed[0].type).toBe('error')
      expect((parsed[0].data as { message: string }).message).toContain('answer is required')
      expect((parsed[0].data as { code?: string }).code).toBe('MISSING_ANSWER')
    })

    it('should return error for missing sessionId', async () => {
      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({ answer: 'My response' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      expect(response.status).toBe(400)
      expect(parsed[0].type).toBe('error')
      expect((parsed[0].data as { message: string }).message).toContain('sessionId is required')
      expect((parsed[0].data as { code?: string }).code).toBe('MISSING_SESSION_ID')
    })

    it('should accept valid request with answer and sessionId', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Option A',
          sessionId: 'session_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)

      expect(response.status).toBe(200)
      expect(mockRunClaude).toHaveBeenCalled()
    })
  })

  describe('SSE Response Headers', () => {
    it('should return correct SSE headers', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'test',
          sessionId: 'session_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)

      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      expect(response.headers.get('Connection')).toBe('keep-alive')
    })
  })

  describe('Claude Execution', () => {
    it('should call runClaude with sessionId for resume', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Option A',
          sessionId: 'session_abc123',
          projectPath: '/my/project',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockRunClaude).toHaveBeenCalledWith({
        prompt: 'Option A',
        cwd: '/my/project',
        sessionId: 'session_abc123',
        imagePaths: undefined,
      })
    })

    it('should use process.cwd() when projectPath not provided', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Continue',
          sessionId: 'session_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockRunClaude).toHaveBeenCalledWith({
        prompt: 'Continue',
        cwd: process.cwd(),
        sessionId: 'session_123',
        imagePaths: undefined,
      })
    })

    it('should pass imagePaths to runClaude', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const imagePaths = ['/tmp/uploads/additional.jpg']

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Here is another image',
          sessionId: 'session_123',
          imagePaths,
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockRunClaude).toHaveBeenCalledWith({
        prompt: 'Here is another image',
        cwd: process.cwd(),
        sessionId: 'session_123',
        imagePaths,
      })
    })
  })

  describe('Event Streaming', () => {
    it('should stream text events', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Thank you for ' } },
        { type: 'text', data: { content: 'your response!' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Option A',
          sessionId: 'session_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const textEvents = parsed.filter(e => e.type === 'text')
      expect(textEvents).toHaveLength(2)
      expect((textEvents[0].data as { content: string }).content).toBe('Thank you for ')
      expect((textEvents[1].data as { content: string }).content).toBe('your response!')
    })

    it('should stream follow-up question events', async () => {
      const questionData = {
        toolUseId: 'tool_456',
        questions: [
          {
            question: 'Any additional preferences?',
            header: 'Preferences',
            options: [
              { label: 'Yes', description: 'Add more' },
              { label: 'No', description: 'Done' },
            ],
            multiSelect: false,
          },
        ],
      }

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Processing...' } },
        { type: 'question', data: questionData },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Option A',
          sessionId: 'session_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const questionEvent = parsed.find(e => e.type === 'question')
      expect(questionEvent).toBeDefined()
      expect((questionEvent?.data as { toolUseId: string }).toolUseId).toBe('tool_456')
    })

    it('should stream result event', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'result', data: { content: 'Completed successfully' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Final answer',
          sessionId: 'session_123',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const resultEvent = parsed.find(e => e.type === 'result')
      expect(resultEvent).toBeDefined()
      expect((resultEvent?.data as { content: string }).content).toBe('Completed successfully')
    })

    it('should stream done event at the end', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Response' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'test',
          sessionId: 'session_123',
        }),
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
    it('should save user answer to conversation when planId provided', async () => {
      const plan = createMockPlan({ id: 'plan_456' })

      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })
      mockPrisma.plan.update.mockResolvedValue(plan)

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Response' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'My selected option',
          sessionId: 'session_123',
          planId: 'plan_456',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: {
          planId: 'plan_456',
          role: 'user',
          content: 'My selected option',
        },
      })
    })

    it('should clear pendingQuestion when answer received', async () => {
      const plan = createMockPlan({ id: 'plan_456' })

      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })
      mockPrisma.plan.update.mockResolvedValue(plan)

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'My answer',
          sessionId: 'session_123',
          planId: 'plan_456',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: 'plan_456' },
        data: { pendingQuestion: expect.anything() }, // DbNull symbol
      })
    })

    it('should save assistant response to conversation', async () => {
      const plan = createMockPlan({ id: 'plan_456' })

      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })
      mockPrisma.plan.update.mockResolvedValue(plan)

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Here is ' } },
        { type: 'text', data: { content: 'my response' } },
        { type: 'result', data: { content: 'Done' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Option A',
          sessionId: 'session_123',
          planId: 'plan_456',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      await readSSEStream(response)

      // Should save assistant message with accumulated content
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planId: 'plan_456',
            role: 'assistant',
            content: 'Here is my response',
          }),
        })
      )
    })

    it('should not save to database when planId not provided', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Response' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Option A',
          sessionId: 'session_123',
          // No planId
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockPrisma.conversation.create).not.toHaveBeenCalled()
      expect(mockPrisma.plan.update).not.toHaveBeenCalled()
    })

    it('should continue execution even if database operations fail', async () => {
      mockPrisma.conversation.create.mockRejectedValue(new Error('DB error'))

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Response' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Option A',
          sessionId: 'session_123',
          planId: 'plan_456',
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
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })
      mockPrisma.plan.update.mockResolvedValue({ id: 'plan_456' })

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'result', data: { content: 'Done' } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Option A',
          sessionId: 'session_123',
          planId: 'plan_456',
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

  describe('Follow-up Question Handling', () => {
    it('should save new pendingQuestion when Claude asks follow-up', async () => {
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })
      mockPrisma.plan.update.mockResolvedValue({ id: 'plan_456' })

      const followUpQuestion = {
        toolUseId: 'tool_789',
        questions: [
          { question: 'Follow-up question?', header: 'Follow-up', options: [], multiSelect: false },
        ],
      }

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Processing...' } },
        { type: 'question', data: followUpQuestion },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'First answer',
          sessionId: 'session_123',
          planId: 'plan_456',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      await readSSEStream(response)

      // Should save the new pendingQuestion
      expect(mockPrisma.plan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'plan_456' },
          data: { pendingQuestion: followUpQuestion },
        })
      )
    })

    it('should save assistant content before question event', async () => {
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })
      mockPrisma.plan.update.mockResolvedValue({ id: 'plan_456' })

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Before question: ' } },
        { type: 'text', data: { content: 'some text' } },
        { type: 'question', data: { toolUseId: 'tool_1', questions: [{ question: 'Q?' }] } },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Initial answer',
          sessionId: 'session_123',
          planId: 'plan_456',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      await readSSEStream(response)

      // Should save assistant content that was accumulated before question
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'assistant',
            content: 'Before question: some text',
          }),
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle runClaude errors gracefully', async () => {
      mockRunClaude.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          throw new Error('Session not found')
        },
      })

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'test',
          sessionId: 'invalid_session',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const errorEvent = parsed.find(e => e.type === 'error')
      expect(errorEvent).toBeDefined()
      expect((errorEvent?.data as { message: string }).message).toContain('Session not found')
    })

    it('should include process_error type for execution errors', async () => {
      mockRunClaude.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          throw new Error('Process crashed')
        },
      })

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'test',
          sessionId: 'session_123',
        }),
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
    it('should handle additional images in continued conversation', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const newImages = ['/tmp/uploads/new1.jpg', '/tmp/uploads/new2.png']

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Here are more images to analyze',
          sessionId: 'session_123',
          imagePaths: newImages,
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(mockRunClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          imagePaths: newImages,
        })
      )
    })

    it('should handle empty image paths in continuation', async () => {
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Text only response',
          sessionId: 'session_123',
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

  describe('Multi-turn Conversation', () => {
    it('should maintain conversation context across turns', async () => {
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })
      mockPrisma.plan.update.mockResolvedValue({ id: 'plan_456' })

      // First continuation
      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'First response' } },
        { type: 'question', data: { toolUseId: 'tool_1', questions: [{ question: 'Q1?' }] } },
        { type: 'done', data: {} },
      ]))

      const request1 = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Answer 1',
          sessionId: 'session_123',
          planId: 'plan_456',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request1 as any)

      // Verify first answer was saved
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'user',
            content: 'Answer 1',
          }),
        })
      )

      // Second continuation
      jest.clearAllMocks()
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_2' })
      mockPrisma.plan.update.mockResolvedValue({ id: 'plan_456' })

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'text', data: { content: 'Second response' } },
        { type: 'result', data: { content: 'Done' } },
        { type: 'done', data: {} },
      ]))

      const request2 = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Answer 2',
          sessionId: 'session_123',
          planId: 'plan_456',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request2 as any)

      // Verify second answer was saved
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'user',
            content: 'Answer 2',
          }),
        })
      )
    })

    it('should handle multiple follow-up questions', async () => {
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv_1' })
      mockPrisma.plan.update.mockResolvedValue({ id: 'plan_456' })

      // Response with multiple questions
      const multiQuestionData = {
        toolUseId: 'tool_multi',
        questions: [
          { question: 'Question 1?', header: 'Q1', options: [], multiSelect: false },
          { question: 'Question 2?', header: 'Q2', options: [], multiSelect: true },
        ],
      }

      mockRunClaude.mockReturnValue(createAsyncIterable([
        { type: 'question', data: multiQuestionData },
        { type: 'done', data: {} },
      ]))

      const request = new Request('http://localhost:3000/api/claude/continue', {
        method: 'POST',
        body: JSON.stringify({
          answer: 'Previous answer',
          sessionId: 'session_123',
          planId: 'plan_456',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const events = await readSSEStream(response)
      const parsed = parseSSEEvents(events)

      const questionEvent = parsed.find(e => e.type === 'question')
      expect(questionEvent).toBeDefined()
      expect((questionEvent?.data as { questions: unknown[] }).questions).toHaveLength(2)
    })
  })
})
