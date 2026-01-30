/**
 * Tests for App Mention Listener
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SayFn, App } from '@slack/bolt'
import type { AppMentionEvent } from '@slack/bolt/dist/types/events/app-mention-event'
import { extractBotUserId, extractPrompt, registerAppMentionListener, sendPlaceholderAndStart } from '../src/listeners/app-mention'

// Mock environment
const ORIGINAL_WEB_URL = process.env.WEB_URL

describe('extractBotUserId', () => {
  it('should extract bot user ID from mention', () => {
    const result = extractBotUserId('<@U123ABC456> hello')
    expect(result).toBe('U123ABC456')
  })

  it('should return null if no mention found', () => {
    const result = extractBotUserId('hello world')
    expect(result).toBeNull()
  })

  it('should extract bot user ID at end of text', () => {
    const result = extractBotUserId('hello <@U789XYZ123>')
    expect(result).toBe('U789XYZ123')
  })

  it('should handle multiple mentions and return first', () => {
    const result = extractBotUserId('<@U111> and <@U222>')
    expect(result).toBe('U111')
  })
})

describe('extractPrompt', () => {
  it('should extract prompt after bot mention', () => {
    const result = extractPrompt('<@U123ABC456> help me with this')
    expect(result).toBe('help me with this')
  })

  it('should handle mention at start with no space', () => {
    const result = extractPrompt('<@U123>test')
    expect(result).toBe('test')
  })

  it('should trim leading whitespace after mention', () => {
    const result = extractPrompt('<@U123>   what is this?')
    expect(result).toBe('what is this?')
  })

  it('should return empty string if only mention', () => {
    const result = extractPrompt('<@U123>')
    expect(result).toBe('')
  })

  it('should remove all mentions', () => {
    const result = extractPrompt('<@U111> <@U222> actual prompt')
    expect(result).toBe('actual prompt')
  })

  it('should return original text if no mention found', () => {
    const result = extractPrompt('just some text')
    expect(result).toBe('just some text')
  })
})

describe('sendPlaceholderAndStart', () => {
  beforeEach(() => {
    process.env.WEB_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    if (ORIGINAL_WEB_URL !== undefined) {
      process.env.WEB_URL = ORIGINAL_WEB_URL
    } else {
      delete process.env.WEB_URL
    }
    vi.restoreAllMocks()
  })

  it('should send placeholder message in thread', async () => {
    const mockSay = vi.fn() as unknown as SayFn
    await sendPlaceholderAndStart(mockSay, '123.456', 'U123ABC')

    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.text).toContain('Hi <@U123ABC>')
    expect(sayCall.text).toContain('Let me think about that...')
    expect(sayCall.thread_ts).toBe('123.456')
  })

  it('should handle undefined threadTs', async () => {
    const mockSay = vi.fn() as unknown as SayFn
    await sendPlaceholderAndStart(mockSay, undefined, 'U123ABC')

    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.thread_ts).toBeUndefined()
  })
})

describe('registerAppMentionListener', () => {
  let mockApp: { event: vi.Mock }
  let mockSay: SayFn

  beforeEach(() => {
    process.env.WEB_URL = 'http://localhost:3000'
    mockSay = vi.fn()
    mockApp = {
      event: vi.fn(),
    }
  })

  afterEach(() => {
    if (ORIGINAL_WEB_URL !== undefined) {
      process.env.WEB_URL = ORIGINAL_WEB_URL
    } else {
      delete process.env.WEB_URL
    }
    vi.restoreAllMocks()
  })

  it('should register app_mention event handler', () => {
    registerAppMentionListener(mockApp as unknown as App)

    expect(mockApp.event).toHaveBeenCalledWith('app_mention', expect.any(Function))
  })

  it('should send greeting when no prompt provided', async () => {
    registerAppMentionListener(mockApp as unknown as App)

    // Get the registered handler
    const eventHandler = mockApp.event.mock.calls[0][1]

    // Simulate event with only mention - Slack Bolt passes { event, say } as first arg
    await eventHandler({
      event: {
        text: '<@U123ABC456>',
        channel: 'C123',
        ts: '123.456',
        user: 'U123ABC456',
      } as AppMentionEvent,
      say: mockSay,
    })

    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.text).toContain('Hi <@U123ABC456>')
    expect(sayCall.thread_ts).toBe('123.456')
  })

  it('should send placeholder and attempt to start conversation when prompt provided', async () => {
    // Mock the fetch for channel-to-project API
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ projectId: 'proj-123', projectName: 'test-project', projectPath: '/path/to/project' }),
    } as Response)
    vi.spyOn(global, 'fetch').mockImplementation(mockFetch)

    // Mock startConversation to avoid actual API calls
    const startConversationMock = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(await import('../src/services/conversation-manager'), 'startConversation').mockImplementation(startConversationMock)

    registerAppMentionListener(mockApp as unknown as App)

    // Get the registered handler
    const eventHandler = mockApp.event.mock.calls[0][1]

    // Simulate event with mention and prompt - Slack Bolt passes { event, say } as first arg
    await eventHandler({
      event: {
        text: '<@U123ABC456> help me write code',
        channel: 'C123',
        ts: '123.456',
        user: 'U123ABC456',
      } as AppMentionEvent,
      say: mockSay,
    })

    // Should send placeholder message first
    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.text).toContain('Hi <@U123ABC456>')
    expect(sayCall.text).toContain('Let me think about that...')
    expect(sayCall.thread_ts).toBe('123.456')

    // Should have called startConversation
    expect(startConversationMock).toHaveBeenCalledTimes(1)
    expect(startConversationMock).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'help me write code',
      projectId: 'proj-123',
      projectPath: '/path/to/project',
    }))
  })
})