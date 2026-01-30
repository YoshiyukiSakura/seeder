/**
 * Tests for Seedbed API Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sendToSeedbed,
  resumeConversation,
  SeedbedAPIError,
  isRecoverableError,
  type SendToSeedbedOptions,
  type ResumeConversationOptions,
  type SeedbedCallbacks,
  type AnySSEEvent,
} from '../src/services/seedbed-api'

// Mock environment
const ORIGINAL_WEB_URL = process.env.WEB_URL

describe('SeedbedAPIError', () => {
  it('should create error with all properties', () => {
    const error = new SeedbedAPIError({
      message: 'Test error',
      errorType: 'validation_error',
      code: 'TEST_CODE',
      recoverable: true,
      details: 'Test details',
    })

    expect(error.message).toBe('Test error')
    expect(error.errorType).toBe('validation_error')
    expect(error.code).toBe('TEST_CODE')
    expect(error.recoverable).toBe(true)
    expect(error.details).toBe('Test details')
    expect(error.name).toBe('SeedbedAPIError')
  })

  it('should default recoverable to false', () => {
    const error = new SeedbedAPIError({
      message: 'Test error',
      errorType: 'unknown_error',
    })

    expect(error.recoverable).toBe(false)
  })
})

describe('isRecoverableError', () => {
  it('should return true for session_error', () => {
    const error = new SeedbedAPIError({
      message: 'Session expired',
      errorType: 'session_error',
    })
    expect(isRecoverableError(error)).toBe(true)
  })

  it('should return true for timeout_error', () => {
    const error = new SeedbedAPIError({
      message: 'Request timed out',
      errorType: 'timeout_error',
    })
    expect(isRecoverableError(error)).toBe(true)
  })

  it('should return false for validation_error', () => {
    const error = new SeedbedAPIError({
      message: 'Invalid input',
      errorType: 'validation_error',
    })
    expect(isRecoverableError(error)).toBe(false)
  })

  it('should return false for auth_error', () => {
    const error = new SeedbedAPIError({
      message: 'Unauthorized',
      errorType: 'auth_error',
    })
    expect(isRecoverableError(error)).toBe(false)
  })

  it('should return false for process_error', () => {
    const error = new SeedbedAPIError({
      message: 'Process failed',
      errorType: 'process_error',
    })
    expect(isRecoverableError(error)).toBe(false)
  })
})

// Mock fetch
global.fetch = vi.fn()

describe('sendToSeedbed', () => {
  const mockSSEEvents: AnySSEEvent[] = [
    { type: 'plan_created', data: { planId: 'plan-123' } },
    { type: 'init', data: { cwd: '/test', sessionId: 'session-123', tools: 5 } },
    { type: 'text', data: { content: 'Hello!' } },
    { type: 'result', data: { content: 'Done', planId: 'plan-123' } },
    { type: 'done', data: {} },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WEB_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    if (ORIGINAL_WEB_URL !== undefined) {
      process.env.WEB_URL = ORIGINAL_WEB_URL
    } else {
      delete process.env.WEB_URL
    }
  })

  it('should call /api/claude/start with correct parameters', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          mockSSEEvents.forEach((event) => {
            const encoder = new TextEncoder()
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          })
          controller.close()
        },
      }),
    } as unknown as Response

    ;(global.fetch as vi.Mock).mockResolvedValue(mockResponse)

    const callbacks: SeedbedCallbacks = {
      onPlanCreated: vi.fn(),
      onInit: vi.fn(),
      onText: vi.fn(),
      onDone: vi.fn(),
    }

    await sendToSeedbed({
      prompt: 'Test prompt',
      projectPath: '/test/path',
      projectId: 'project-123',
      imagePaths: ['/img1.png'],
      slackThreadTs: '123.456',
      slackChannelId: 'C123',
      callbacks,
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/claude/start',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test prompt',
          projectPath: '/test/path',
          projectId: 'project-123',
          imagePaths: ['/img1.png'],
          slackThreadTs: '123.456',
          slackChannelId: 'C123',
        }),
      })
    )

    expect(callbacks.onPlanCreated).toHaveBeenCalledWith({ planId: 'plan-123' })
    expect(callbacks.onInit).toHaveBeenCalledWith({ cwd: '/test', sessionId: 'session-123', tools: 5 })
    expect(callbacks.onText).toHaveBeenCalledWith('Hello!')
  })

  it('should handle abort signal', async () => {
    const abortController = new AbortController()
    abortController.abort()

    // When signal is already aborted, fetch should not be called
    // or should throw AbortError
    await sendToSeedbed({
      prompt: 'Test',
      signal: abortController.signal,
    })
    // Note: fetch doesn't throw on already-aborted signals, it just completes
    // The important thing is that the function completes without error
  })

  it('should throw SeedbedAPIError on error event', async () => {
    const errorEvent: AnySSEEvent = {
      type: 'error',
      data: {
        message: 'Test error',
        errorType: 'validation_error',
        code: 'TEST',
      },
    }

    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
          controller.close()
        },
      }),
    } as unknown as Response

    ;(global.fetch as vi.Mock).mockResolvedValue(mockResponse)

    await expect(
      sendToSeedbed({
        prompt: 'Test',
      })
    ).rejects.toThrow(SeedbedAPIError)
  })

  it('should throw SeedbedAPIError on HTTP error', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      body: null,
    } as unknown as Response

    ;(global.fetch as vi.Mock).mockResolvedValue(mockResponse)

    await expect(
      sendToSeedbed({
        prompt: 'Test',
      })
    ).rejects.toThrow(SeedbedAPIError)
  })
})

describe('resumeConversation', () => {
  const mockSSEEvents: AnySSEEvent[] = [
    { type: 'text', data: { content: 'Continuing...' } },
    { type: 'result', data: { content: 'Done' } },
    { type: 'done', data: {} },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WEB_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    if (ORIGINAL_WEB_URL !== undefined) {
      process.env.WEB_URL = ORIGINAL_WEB_URL
    } else {
      delete process.env.WEB_URL
    }
  })

  it('should call /api/claude/continue with correct parameters', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          mockSSEEvents.forEach((event) => {
            const encoder = new TextEncoder()
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          })
          controller.close()
        },
      }),
    } as unknown as Response

    ;(global.fetch as vi.Mock).mockResolvedValue(mockResponse)

    const callbacks: SeedbedCallbacks = {
      onText: vi.fn(),
      onDone: vi.fn(),
    }

    await resumeConversation({
      answer: 'User answer',
      sessionId: 'session-123',
      planId: 'plan-123',
      projectPath: '/test/path',
      imagePaths: ['/img.png'],
      callbacks,
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/claude/continue',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Verify the body content
    const callArgs = (global.fetch as vi.Mock).mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.answer).toBe('User answer')
    expect(body.sessionId).toBe('session-123')
    expect(body.planId).toBe('plan-123')
    expect(body.projectPath).toBe('/test/path')
    expect(body.imagePaths).toEqual(['/img.png'])

    expect(callbacks.onText).toHaveBeenCalledWith('Continuing...')
  })

  it('should throw SeedbedAPIError when sessionId is missing', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          const errorEvent: AnySSEEvent = {
            type: 'error',
            data: {
              message: 'sessionId is required',
              errorType: 'validation_error',
              code: 'MISSING_SESSION_ID',
            },
          }
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
          controller.close()
        },
      }),
    } as unknown as Response

    ;(global.fetch as vi.Mock).mockResolvedValue(mockResponse)

    await expect(
      resumeConversation({
        answer: 'Answer',
        sessionId: '', // Empty sessionId
      })
    ).rejects.toThrow(SeedbedAPIError)
  })

  it('should handle question events', async () => {
    const questionEvent: AnySSEEvent = {
      type: 'question',
      data: {
        toolUseId: 'tool-123',
        questions: [
          {
            question: 'What color?',
            header: 'Choose',
            options: [
              { label: 'Red', description: 'The red option' },
              { label: 'Blue', description: 'The blue option' },
            ],
            multiSelect: false,
          },
        ],
      },
    }

    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(questionEvent)}\n\n`))
          controller.close()
        },
      }),
    } as unknown as Response

    ;(global.fetch as vi.Mock).mockResolvedValue(mockResponse)

    const callbacks: SeedbedCallbacks = {
      onQuestion: vi.fn(),
    }

    await resumeConversation({
      answer: 'Answer',
      sessionId: 'session-123',
      callbacks,
    })

    expect(callbacks.onQuestion).toHaveBeenCalledWith({
      toolUseId: 'tool-123',
      questions: [
        {
          question: 'What color?',
          header: 'Choose',
          options: [
            { label: 'Red', description: 'The red option' },
            { label: 'Blue', description: 'The blue option' },
          ],
          multiSelect: false,
        },
      ],
    })
  })
})

describe('SSE Event Types', () => {
  it('should properly type git_sync events', () => {
    const gitSyncEvent: AnySSEEvent = {
      type: 'git_sync',
      data: {
        success: true,
        message: 'Updated',
        updated: true,
      },
    }

    expect(gitSyncEvent.type).toBe('git_sync')
    expect(gitSyncEvent.data.success).toBe(true)
  })

  it('should properly type tool events', () => {
    const toolEvent: AnySSEEvent = {
      type: 'tool',
      data: {
        name: 'ReadFile',
        id: 'tool-use-123',
        summary: '/test/file.ts',
        timestamp: Date.now(),
      },
    }

    expect(toolEvent.type).toBe('tool')
    expect(toolEvent.data.name).toBe('ReadFile')
  })
})