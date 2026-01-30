/**
 * Tests for Thread Message Listener
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { App } from '@slack/bolt'
import {
  registerThreadMessageListener,
  isBotMessage,
} from '../src/listeners/thread-message'
import { getPlanByThread } from '../src/utils/api'
import {
  createMockSay,
  createMockWebClient,
  createMockApp,
  createMockMessageEvent,
  createMockJsonResponse,
  createMockErrorResponse,
} from './utils/mocks'
import { apiResponses } from './utils/fixtures'

// Mock environment
const ORIGINAL_WEB_URL = process.env.WEB_URL

describe('isBotMessage', () => {
  it('should return true for message with bot_id', () => {
    const event = { bot_id: 'B123' }
    expect(isBotMessage(event)).toBe(true)
  })

  it('should return true for message with bot_message subtype', () => {
    const event = { subtype: 'bot_message' }
    expect(isBotMessage(event)).toBe(true)
  })

  it('should return false for regular user message', () => {
    const event = { user: 'U123' }
    expect(isBotMessage(event)).toBe(false)
  })

  it('should return false for empty event', () => {
    const event = {}
    expect(isBotMessage(event)).toBe(false)
  })

  it('should return true when both bot_id and user are present', () => {
    const event = { bot_id: 'B123', user: 'U123' }
    expect(isBotMessage(event)).toBe(true)
  })

  it('should return false for message with only app_id (not a bot message)', () => {
    // app_id alone does not indicate a bot message
    const event = { app_id: 'A123' }
    expect(isBotMessage(event)).toBe(false)
  })
})

describe('getPlanByThread', () => {
  beforeEach(() => {
    process.env.WEB_URL = 'http://localhost:3000'
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (ORIGINAL_WEB_URL !== undefined) {
      process.env.WEB_URL = ORIGINAL_WEB_URL
    } else {
      delete process.env.WEB_URL
    }
    vi.restoreAllMocks()
  })

  it('should return plan data when API returns success', async () => {
    const mockResponse = createMockJsonResponse(apiResponses.threadToPlan.success)
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    const result = await getPlanByThread('C123', '123.456')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/slack/thread-to-plan?channelId=C123&threadTs=123.456',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    expect(result).toEqual(apiResponses.threadToPlan.success)
  })

  it('should return null when API returns 404', async () => {
    const mockResponse = createMockErrorResponse(404)
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    const result = await getPlanByThread('C123', '999.999')

    expect(result).toBeNull()
  })

  it('should throw error when API returns other error status', async () => {
    const mockResponse = createMockErrorResponse(500, 'Internal Server Error')
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await expect(getPlanByThread('C123', '123.456')).rejects.toThrow(
      'Failed to get plan: 500'
    )
  })

  it('should use default WEB_URL when not set', async () => {
    delete process.env.WEB_URL
    const mockResponse = createMockJsonResponse(apiResponses.threadToPlan.success)
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await getPlanByThread('C123', '123.456')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000/'),
      expect.anything()
    )
  })

  it('should encode channelId and threadTs in URL', async () => {
    const mockResponse = createMockJsonResponse(apiResponses.threadToPlan.success)
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await getPlanByThread('C123#special', '123.456&test')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('channelId=C123%23special'),
      expect.anything()
    )
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('threadTs=123.456%26test'),
      expect.anything()
    )
  })
})

describe('registerThreadMessageListener', () => {
  let mockApp: ReturnType<typeof createMockApp>
  let mockSay: ReturnType<typeof createMockSay>
  let mockClient: ReturnType<typeof createMockWebClient>

  beforeEach(() => {
    process.env.WEB_URL = 'http://localhost:3000'
    mockApp = createMockApp()
    mockSay = createMockSay()
    mockClient = createMockWebClient()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (ORIGINAL_WEB_URL !== undefined) {
      process.env.WEB_URL = ORIGINAL_WEB_URL
    } else {
      delete process.env.WEB_URL
    }
    vi.restoreAllMocks()
  })

  it('should register message event handler', () => {
    registerThreadMessageListener(mockApp as unknown as App)

    expect(mockApp.event).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('should ignore bot messages', async () => {
    registerThreadMessageListener(mockApp as unknown as App)
    const eventHandler = mockApp.event.mock.calls[0][1]

    const mockFetch = vi.spyOn(global, 'fetch')

    await eventHandler({
      event: createMockMessageEvent({
        bot_id: 'B123',
        thread_ts: '100.000',
      }),
      say: mockSay,
      client: mockClient,
    })

    // Should not call API for bot messages
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockSay).not.toHaveBeenCalled()
  })

  it('should process messages with app_id (user messages from apps)', async () => {
    // app_id alone does not indicate a bot message, so these should be processed
    registerThreadMessageListener(mockApp as unknown as App)
    const eventHandler = mockApp.event.mock.calls[0][1]

    // Mock API to return 404 (not a Seeder thread)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)
    vi.spyOn(global, 'fetch').mockImplementation(mockFetch)

    await eventHandler({
      event: createMockMessageEvent({
        app_id: 'A123',
        thread_ts: '100.000',
      }),
      say: mockSay,
      client: mockClient,
    })

    // API should be called since app_id alone is not a bot indicator
    expect(mockFetch).toHaveBeenCalled()
  })

  it('should ignore top-level messages (no thread_ts)', async () => {
    registerThreadMessageListener(mockApp as unknown as App)
    const eventHandler = mockApp.event.mock.calls[0][1]

    const mockFetch = vi.spyOn(global, 'fetch')

    await eventHandler({
      event: createMockMessageEvent({
        thread_ts: undefined,
      }),
      say: mockSay,
      client: mockClient,
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockSay).not.toHaveBeenCalled()
  })

  it('should ignore thread parent messages (thread_ts === ts)', async () => {
    registerThreadMessageListener(mockApp as unknown as App)
    const eventHandler = mockApp.event.mock.calls[0][1]

    const mockFetch = vi.spyOn(global, 'fetch')

    await eventHandler({
      event: createMockMessageEvent({
        ts: '123.456',
        thread_ts: '123.456', // Same as ts = thread parent
      }),
      say: mockSay,
      client: mockClient,
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockSay).not.toHaveBeenCalled()
  })

  it('should ignore messages without user', async () => {
    registerThreadMessageListener(mockApp as unknown as App)
    const eventHandler = mockApp.event.mock.calls[0][1]

    const mockFetch = vi.spyOn(global, 'fetch')

    await eventHandler({
      event: {
        ts: '123.456',
        thread_ts: '100.000',
        channel: 'C123',
        text: 'Test',
        // No user field
      },
      say: mockSay,
      client: mockClient,
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockSay).not.toHaveBeenCalled()
  })

  it('should ignore messages without channel', async () => {
    registerThreadMessageListener(mockApp as unknown as App)
    const eventHandler = mockApp.event.mock.calls[0][1]

    const mockFetch = vi.spyOn(global, 'fetch')

    await eventHandler({
      event: {
        ts: '123.456',
        thread_ts: '100.000',
        user: 'U123',
        text: 'Test',
        // No channel field
      },
      say: mockSay,
      client: mockClient,
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockSay).not.toHaveBeenCalled()
  })

  it('should ignore threads not associated with Seeder (getPlanByThread returns null)', async () => {
    registerThreadMessageListener(mockApp as unknown as App)
    const eventHandler = mockApp.event.mock.calls[0][1]

    // Mock API to return 404 (not found)
    const mockResponse = createMockErrorResponse(404)
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    // Mock continueConversation to track if it's called
    const continueConversationMock = vi.fn()
    vi.spyOn(
      await import('../src/services/conversation-manager'),
      'continueConversation'
    ).mockImplementation(continueConversationMock)

    await eventHandler({
      event: createMockMessageEvent({
        ts: '123.456',
        thread_ts: '100.000', // Different from ts = reply
      }),
      say: mockSay,
      client: mockClient,
    })

    // API should be called
    expect(global.fetch).toHaveBeenCalled()
    // But say should not be called since thread is not associated with Seeder
    expect(mockSay).not.toHaveBeenCalled()
    expect(continueConversationMock).not.toHaveBeenCalled()
  })

  it('should process valid thread reply and continue conversation', async () => {
    registerThreadMessageListener(mockApp as unknown as App)
    const eventHandler = mockApp.event.mock.calls[0][1]

    // Mock API to return plan data
    const mockResponse = createMockJsonResponse(apiResponses.threadToPlan.success)
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    // Mock continueConversation
    const continueConversationMock = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(
      await import('../src/services/conversation-manager'),
      'continueConversation'
    ).mockImplementation(continueConversationMock)

    await eventHandler({
      event: createMockMessageEvent({
        ts: '123.456',
        thread_ts: '100.000', // Different from ts = reply
        text: 'User response text',
      }),
      say: mockSay,
      client: mockClient,
    })

    // Should send placeholder message
    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.text).toContain('Let me think about that...')
    expect(sayCall.thread_ts).toBe('100.000')

    // Should call continueConversation
    expect(continueConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: 'User response text',
        projectPath: apiResponses.threadToPlan.success.projectPath,
        sessionId: apiResponses.threadToPlan.success.sessionId,
        planId: apiResponses.threadToPlan.success.planId,
        channelId: 'C123',
        threadTs: '100.000',
      })
    )
  })

  it('should send error message when API call fails', async () => {
    registerThreadMessageListener(mockApp as unknown as App)
    const eventHandler = mockApp.event.mock.calls[0][1]

    // Mock API to throw error
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

    // Suppress console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await eventHandler({
      event: createMockMessageEvent({
        ts: '123.456',
        thread_ts: '100.000',
      }),
      say: mockSay,
      client: mockClient,
    })

    // Should send error message
    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.text).toContain('something went wrong')
    expect(sayCall.thread_ts).toBe('100.000')

    consoleErrorSpy.mockRestore()
  })

  it('should send error message when continueConversation fails', async () => {
    registerThreadMessageListener(mockApp as unknown as App)
    const eventHandler = mockApp.event.mock.calls[0][1]

    // Mock API to return plan data
    const mockResponse = createMockJsonResponse(apiResponses.threadToPlan.success)
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    // Mock continueConversation to throw
    vi.spyOn(
      await import('../src/services/conversation-manager'),
      'continueConversation'
    ).mockRejectedValue(new Error('Conversation error'))

    // Suppress console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await eventHandler({
      event: createMockMessageEvent({
        ts: '123.456',
        thread_ts: '100.000',
      }),
      say: mockSay,
      client: mockClient,
    })

    // Should send placeholder first, then error message
    expect(mockSay).toHaveBeenCalledTimes(2)

    // First call is placeholder
    const firstCall = mockSay.mock.calls[0][0]
    expect(firstCall.text).toContain('Let me think about that...')

    // Second call is error
    const secondCall = mockSay.mock.calls[1][0]
    expect(secondCall.text).toContain('something went wrong')

    consoleErrorSpy.mockRestore()
  })
})
