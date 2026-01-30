/**
 * Tests for Create Channel Command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { App } from '@slack/bolt'
import { parseCommandParams, registerCreateChannelCommand } from '../src/commands/create-channel'

// Mock environment
const ORIGINAL_WEB_URL = process.env.WEB_URL
const ORIGINAL_BOT_SECRET = process.env.BOT_SECRET

describe('parseCommandParams', () => {
  it('should extract projectId from command text', () => {
    const result = parseCommandParams('proj-12345-abcde')
    expect(result.projectId).toBe('proj-12345-abcde')
    expect(result.error).toBeUndefined()
  })

  it('should handle UUID format', () => {
    const result = parseCommandParams('550e8400-e29b-41d4-a716-446655440000')
    expect(result.projectId).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('should trim whitespace', () => {
    const result = parseCommandParams('  proj-123  ')
    expect(result.projectId).toBe('proj-123')
  })

  it('should return error for empty text', () => {
    const result = parseCommandParams('')
    expect(result.projectId).toBeNull()
    expect(result.error).toBe('Missing project ID')
  })

  it('should return error for whitespace only', () => {
    const result = parseCommandParams('   ')
    expect(result.projectId).toBeNull()
    expect(result.error).toBe('Missing project ID')
  })

  it('should handle project ID with special characters', () => {
    const result = parseCommandParams('my-project_name.v2')
    expect(result.projectId).toBe('my-project_name.v2')
  })
})

describe('registerCreateChannelCommand', () => {
  let mockApp: { command: vi.Mock }
  let mockRespond: vi.Mock

  beforeEach(() => {
    process.env.WEB_URL = 'http://localhost:3000'
    process.env.BOT_SECRET = 'test-secret'
    mockRespond = vi.fn()
    mockApp = {
      command: vi.fn(),
    }
  })

  afterEach(() => {
    if (ORIGINAL_WEB_URL !== undefined) {
      process.env.WEB_URL = ORIGINAL_WEB_URL
    } else {
      delete process.env.WEB_URL
    }
    if (ORIGINAL_BOT_SECRET !== undefined) {
      process.env.BOT_SECRET = ORIGINAL_BOT_SECRET
    } else {
      delete process.env.BOT_SECRET
    }
    vi.restoreAllMocks()
  })

  it('should register /seeder-create-channel command', () => {
    registerCreateChannelCommand(mockApp as unknown as App)

    expect(mockApp.command).toHaveBeenCalledWith('/seeder-create-channel', expect.any(Function))
  })

  it('should return error message when projectId is missing', async () => {
    registerCreateChannelCommand(mockApp as unknown as App)

    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: { text: '', user_id: 'U123', user_name: 'testuser' },
      ack: vi.fn(),
      respond: mockRespond,
    })

    expect(mockRespond).toHaveBeenCalledWith({
      response_type: 'ephemeral',
      text: expect.stringContaining('Missing project ID'),
    })
  })

  it('should call API and return success message when channel created', async () => {
    // Mock fetch for API call
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        channelId: 'C123456',
        channelName: 'project-test-project',
      }),
    } as Response)
    vi.spyOn(global, 'fetch').mockImplementation(mockFetch)

    registerCreateChannelCommand(mockApp as unknown as App)

    const commandHandler = mockApp.command.mock.calls[0][1]

    const mockAck = vi.fn()

    await commandHandler({
      command: { text: 'proj-123', user_id: 'U123', user_name: 'testuser' },
      ack: mockAck,
      respond: mockRespond,
    })

    expect(mockAck).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/slack/create-channel',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-bot-secret': 'test-secret',
        }),
        body: JSON.stringify({ projectId: 'proj-123' }),
      })
    )
    expect(mockRespond).toHaveBeenCalledWith(
      expect.objectContaining({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: '*Create Slack Channel*',
            }),
          }),
        ]),
      })
    )
  })

  it('should return existing channel message when channel already exists', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        channelId: 'C123456',
        channelName: 'project-test-project',
        message: 'Channel already exists',
      }),
    } as Response)
    vi.spyOn(global, 'fetch').mockImplementation(mockFetch)

    registerCreateChannelCommand(mockApp as unknown as App)

    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: { text: 'proj-123', user_id: 'U123', user_name: 'testuser' },
      ack: vi.fn(),
      respond: mockRespond,
    })

    expect(mockRespond).toHaveBeenCalledWith(
      expect.objectContaining({
        response_type: 'ephemeral',
      })
    )
    // Check that the response mentions "already exists"
    const respondCall = mockRespond.mock.calls[0][0]
    expect(JSON.stringify(respondCall)).toContain('already exists')
  })

  it('should return error message when API fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Project not found',
      }),
    } as Response)
    vi.spyOn(global, 'fetch').mockImplementation(mockFetch)

    registerCreateChannelCommand(mockApp as unknown as App)

    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: { text: 'invalid-proj', user_id: 'U123', user_name: 'testuser' },
      ack: vi.fn(),
      respond: mockRespond,
    })

    expect(mockRespond).toHaveBeenCalledWith({
      response_type: 'ephemeral',
      text: expect.stringContaining('Failed to create channel'),
    })
  })

  it('should handle API exception', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.spyOn(global, 'fetch').mockImplementation(mockFetch)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    registerCreateChannelCommand(mockApp as unknown as App)

    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: { text: 'proj-123', user_id: 'U123', user_name: 'testuser' },
      ack: vi.fn(),
      respond: mockRespond,
    })

    expect(consoleSpy).toHaveBeenCalledWith('Create channel command error:', expect.any(Error))
    expect(mockRespond).toHaveBeenCalledWith({
      response_type: 'ephemeral',
      text: expect.stringContaining('Network error'),
    })
  })
})