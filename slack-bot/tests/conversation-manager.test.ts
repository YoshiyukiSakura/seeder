/**
 * Tests for Conversation Manager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SayFn } from '@slack/bolt'
import type { WebClient } from '@slack/web-api'
import {
  getWebUrlForPlan,
  getWebUrlForPlanWithMessage,
  createConversationManager,
  createQuestionBlocks,
  getConversationCallbacks,
} from '../src/services/conversation-manager'

// Mock environment
const ORIGINAL_WEB_URL = process.env.WEB_URL

// Create mock WebClient
function createMockClient(): WebClient {
  return {
    chat: {
      postMessage: vi.fn().mockResolvedValue({ ts: '123.789' }),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as WebClient
}

describe('URL Generation', () => {
  beforeEach(() => {
    // Use environment variable or default
    if (!process.env.WEB_URL) {
      process.env.WEB_URL = 'http://localhost:38965'
    }
  })

  afterEach(() => {
    if (ORIGINAL_WEB_URL !== undefined) {
      process.env.WEB_URL = ORIGINAL_WEB_URL
    } else {
      delete process.env.WEB_URL
    }
  })

  it('should generate correct web URL for plan', () => {
    const url = getWebUrlForPlan('plan-123')
    expect(url).toBe(`${process.env.WEB_URL}/?planId=plan-123`)
  })

  it('should generate correct web URL with message anchor', () => {
    const url = getWebUrlForPlanWithMessage('plan-123', '123.456')
    expect(url).toBe(`${process.env.WEB_URL}/?planId=plan-123&msg=123.456`)
  })

  it('should handle custom WEB_URL', () => {
    process.env.WEB_URL = 'https://my-seedbed.example.com'
    const url = getWebUrlForPlan('plan-456')
    expect(url).toBe('https://my-seedbed.example.com/?planId=plan-456')
  })

  it('should handle WEB_URL with trailing slash', () => {
    process.env.WEB_URL = 'http://localhost:3000/'
    const url = getWebUrlForPlan('plan-789')
    expect(url).toBe('http://localhost:3000/?planId=plan-789')
  })

  it('should use default localhost:3000 when WEB_URL is not set', () => {
    delete process.env.WEB_URL
    const url = getWebUrlForPlan('plan-default')
    expect(url).toBe('http://localhost:3000/?planId=plan-default')
  })
})

describe('createConversationManager', () => {
  it('should create a conversation manager with initial state', () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )

    expect(manager.say).toBe(mockSay)
    expect(manager.client).toBe(mockClient)
    expect(manager.channelId).toBe('C123')
    expect(manager.threadTs).toBe('123.456')
    expect(manager.accumulatedText).toBe('')
    expect(manager.updateCount).toBe(0)
    expect(manager.planId).toBe(null)
    expect(manager.currentMessageTs).toBe(null)
  })

  it('should handle undefined threadTs', () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      undefined
    )

    expect(manager.threadTs).toBeUndefined()
  })
})

describe('createQuestionBlocks', () => {
  it('should create question blocks with header', () => {
    const questionData = {
      toolUseId: 'tool-123',
      questions: [
        {
          question: 'What is your choice?',
          header: 'Please select',
          options: [{ label: 'Option A' }, { label: 'Option B' }],
        },
      ],
    }

    const blocks = createQuestionBlocks(questionData, 0)

    // divider + header + question + input + actions = 5 blocks
    expect(blocks).toHaveLength(5)

    // Check header section
    const headerBlock = blocks[1] as { type: string; text: { type: string; text: string } }
    expect(headerBlock.type).toBe('section')
    expect(headerBlock.text.text).toBe('*Please select*')

    // Check question section
    const questionBlock = blocks[2] as { type: string; text: { type: string; text: string } }
    expect(questionBlock.type).toBe('section')
    expect(questionBlock.text.text).toBe('What is your choice?')

    // Check actions block (index 4) has buttons
    const actionsBlock = blocks[4] as { type: string; elements: unknown[] }
    expect(actionsBlock.type).toBe('actions')
    expect(actionsBlock.elements).toHaveLength(3) // 2 option buttons + submit button
  })

  it('should create question blocks without header and without options', () => {
    const questionData = {
      toolUseId: 'tool-456',
      questions: [
        {
          question: 'Enter your name',
        },
      ],
    }

    const blocks = createQuestionBlocks(questionData, 0)

    // divider + question = 2 blocks (no header, no options)
    expect(blocks).toHaveLength(2)

    // First block is divider
    expect(blocks[0]).toEqual({ type: 'divider' })

    // Second block is question section
    const questionBlock = blocks[1] as { type: string; text: { type: string; text: string } }
    expect(questionBlock.type).toBe('section')
    expect(questionBlock.text.text).toBe('Enter your name')
  })

  it('should create question blocks with unique action_ids per option', () => {
    const questionData = {
      toolUseId: 'tool-789',
      questions: [
        {
          question: 'Select a color',
          options: [
            { label: 'Red', description: 'The color of blood' },
            { label: 'Blue', description: 'The color of the sky' },
          ],
        },
      ],
    }

    const blocks = createQuestionBlocks(questionData, 0)

    // No header, so: divider + question + input + actions = 4 blocks
    expect(blocks).toHaveLength(4)

    // actions block at index 3
    const actionsBlock = blocks[3] as { type: string; elements: unknown[] }
    expect(actionsBlock.type).toBe('actions')

    const firstButton = actionsBlock.elements[0] as {
      type: string
      text: { type: string; text: string }
      action_id: string
      value: string
    }
    const secondButton = actionsBlock.elements[1] as {
      type: string
      text: { type: string; text: string }
      action_id: string
      value: string
    }

    expect(firstButton.type).toBe('button')
    expect(firstButton.text.text).toBe('Red')
    expect(firstButton.action_id).toBe('question_option_tool-789_0_0')
    expect(firstButton.value).toBe('Red')

    expect(secondButton.type).toBe('button')
    expect(secondButton.text.text).toBe('Blue')
    expect(secondButton.action_id).toBe('question_option_tool-789_0_1')
    expect(secondButton.value).toBe('Blue')
  })

  it('should handle empty options array', () => {
    const questionData = {
      toolUseId: 'tool-empty',
      questions: [
        {
          question: 'Enter text',
          options: [],
        },
      ],
    }

    const blocks = createQuestionBlocks(questionData, 0)

    // With empty options, we still only get divider + question = 2 blocks
    expect(blocks).toHaveLength(2)

    // No input block is added when options are empty
    const inputBlock = blocks[1] as { type: string; text: { type: string; text: string } }
    expect(inputBlock.type).toBe('section')
    expect(inputBlock.text.text).toBe('Enter text')
  })

  it('should return empty array for invalid question index', () => {
    const questionData = {
      toolUseId: 'tool-invalid',
      questions: [
        {
          question: 'Test?',
        },
      ],
    }

    const blocks = createQuestionBlocks(questionData, 5) // Invalid index

    expect(blocks).toEqual([])
  })
})

describe('getConversationCallbacks', () => {
  it('should return callbacks object with all event handlers', () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )

    const callbacks = getConversationCallbacks(manager)

    expect(callbacks).toHaveProperty('onInit')
    expect(callbacks).toHaveProperty('onText')
    expect(callbacks).toHaveProperty('onQuestion')
    expect(callbacks).toHaveProperty('onTool')
    expect(callbacks).toHaveProperty('onResult')
    expect(callbacks).toHaveProperty('onError')
    expect(callbacks).toHaveProperty('onDone')
    expect(callbacks).toHaveProperty('onGitSync')
    expect(callbacks).toHaveProperty('onPlanCreated')
  })
})

describe('Message Update Logic', () => {
  it('should accumulate text and update on threshold', async () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )

    const callbacks = getConversationCallbacks(manager)

    // Simulate 5 text events (without trailing space/newline to avoid force update)
    for (let i = 0; i < 5; i++) {
      await callbacks.onText?.(`Text${i}`)
    }

    // After 5 events, message should be posted and updateCount reset
    // Note: accumulatedText is preserved for subsequent updates (chat.update)
    expect(manager.updateCount).toBe(0)
    expect(mockClient.chat.postMessage).toHaveBeenCalledTimes(1)

    // Verify the accumulated text was sent
    const postCall = (mockClient.chat.postMessage as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(postCall.text).toContain('Text0')
    expect(postCall.text).toContain('Text4')
    expect(postCall.thread_ts).toBe('123.456')
    expect(postCall.channel).toBe('C123')
  })

  it('should force update on newline', async () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )

    const callbacks = getConversationCallbacks(manager)

    // Simulate text ending with newline
    await callbacks.onText?.('Hello\n')

    // Should force update
    expect(mockClient.chat.postMessage).toHaveBeenCalledTimes(1)
  })

  it('should handle empty text', async () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      undefined
    )

    const callbacks = getConversationCallbacks(manager)

    await callbacks.onText?.('')

    expect(manager.accumulatedText).toBe('')
    expect(mockClient.chat.postMessage).not.toHaveBeenCalled()
  })

  it('should update existing message when currentMessageTs is set', async () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )
    manager.currentMessageTs = '999.888'

    const callbacks = getConversationCallbacks(manager)

    // Simulate text ending with newline to force update
    await callbacks.onText?.('Updated text\n')

    // Should call chat.update instead of chat.postMessage
    expect(mockClient.chat.update).toHaveBeenCalledTimes(1)
    expect(mockClient.chat.postMessage).not.toHaveBeenCalled()

    const updateCall = (mockClient.chat.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateCall.channel).toBe('C123')
    expect(updateCall.ts).toBe('999.888')
    expect(updateCall.text).toContain('Updated text')
  })
})

describe('Error Handling', () => {
  it('should send error message on error event', async () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )

    const callbacks = getConversationCallbacks(manager)

    await callbacks.onError?.({
      message: 'Test error',
      errorType: 'validation_error',
      recoverable: false,
    })

    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.text).toContain('*Error:* Test error')
    expect(sayCall.thread_ts).toBe('123.456')
  })

  it('should add help text for recoverable errors', async () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )

    const callbacks = getConversationCallbacks(manager)

    await callbacks.onError?.({
      message: 'Session expired',
      errorType: 'session_error',
      recoverable: true,
    })

    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.blocks).toBeInstanceOf(Array)
    expect(sayCall.blocks).toHaveLength(2) // section + context
  })
})

describe('Plan Created', () => {
  it('should save planId and send web link', async () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )

    const callbacks = getConversationCallbacks(manager)

    await callbacks.onPlanCreated?.({ planId: 'plan-abc' })

    expect(manager.planId).toBe('plan-abc')
    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.text).toContain('/?planId=plan-abc')
    expect(sayCall.thread_ts).toBe('123.456')
  })
})

describe('Done Event', () => {
  it('should send completion message with plan link if planId exists', async () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )
    manager.planId = 'plan-existing'

    const callbacks = getConversationCallbacks(manager)

    await callbacks.onDone?.({})

    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.text).toContain('Conversation complete')
    expect(sayCall.text).toContain('/?planId=plan-existing')
  })

  it('should send completion message without link if no planId', async () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )
    // No planId set

    const callbacks = getConversationCallbacks(manager)

    await callbacks.onDone?.({})

    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.text).toContain('Conversation complete')
    expect(sayCall.text).not.toContain('planId=')
  })
})

describe('Init Event', () => {
  it('should send init message for new conversation', async () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )

    const callbacks = getConversationCallbacks(manager)

    await callbacks.onInit?.({ cwd: '/test', resuming: false, tools: 5 })

    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.text).toContain('Starting new conversation')
  })

  it('should send init message for resuming conversation', async () => {
    const mockSay = vi.fn()
    const mockClient = createMockClient()
    const manager = createConversationManager(
      mockSay as SayFn,
      mockClient,
      'C123',
      '123.456'
    )

    const callbacks = getConversationCallbacks(manager)

    await callbacks.onInit?.({ cwd: '/test', resuming: true, tools: 5 })

    expect(mockSay).toHaveBeenCalledTimes(1)
    const sayCall = mockSay.mock.calls[0][0]
    expect(sayCall.text).toContain('Resuming conversation')
  })
})