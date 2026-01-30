/**
 * Tests for Create Channel Command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { App } from '@slack/bolt'
import { fallbackMatch, formatProjectList, registerCreateChannelCommand } from '../src/commands/create-channel'

// Mock environment
const ORIGINAL_WEB_URL = process.env.WEB_URL
const ORIGINAL_BOT_SECRET = process.env.BOT_SECRET

const mockProjects = [
  { id: 'proj-1', name: 'My Awesome Project', hasChannel: false },
  { id: 'proj-2', name: 'Another Project', hasChannel: true, channelName: 'project-another' },
  { id: 'proj-3', name: 'Test App', hasChannel: false },
]

describe('fallbackMatch', () => {
  it('should return exact match with high confidence', () => {
    const result = fallbackMatch('My Awesome Project', mockProjects)
    expect(result.projectId).toBe('proj-1')
    expect(result.projectName).toBe('My Awesome Project')
    expect(result.confidence).toBe('high')
  })

  it('should be case insensitive', () => {
    const result = fallbackMatch('my awesome project', mockProjects)
    expect(result.projectId).toBe('proj-1')
    expect(result.confidence).toBe('high')
  })

  it('should return partial match with high confidence when unique', () => {
    const result = fallbackMatch('Awesome', mockProjects)
    expect(result.projectId).toBe('proj-1')
    expect(result.confidence).toBe('high')
    expect(result.reason).toBe('Partial match')
  })

  it('should return low confidence when multiple matches', () => {
    const result = fallbackMatch('Project', mockProjects)
    expect(result.projectId).toBeNull()
    expect(result.confidence).toBe('low')
    expect(result.reason).toContain('Multiple matches')
  })

  it('should return none confidence when no match', () => {
    const result = fallbackMatch('nonexistent', mockProjects)
    expect(result.projectId).toBeNull()
    expect(result.confidence).toBe('none')
  })

  it('should handle empty project list', () => {
    const result = fallbackMatch('anything', [])
    expect(result.projectId).toBeNull()
    expect(result.confidence).toBe('none')
  })
})

describe('formatProjectList', () => {
  it('should format projects with channel info', () => {
    const result = formatProjectList(mockProjects)
    expect(result).toContain('1. *My Awesome Project*')
    expect(result).toContain('2. *Another Project* → #project-another')
    expect(result).toContain('3. *Test App*')
  })

  it('should handle empty list', () => {
    const result = formatProjectList([])
    expect(result).toBe('No projects found.')
  })
})

describe('registerCreateChannelCommand', () => {
  let mockApp: { command: vi.Mock; action: vi.Mock }
  let mockRespond: vi.Mock

  beforeEach(() => {
    process.env.WEB_URL = 'http://localhost:3000'
    process.env.BOT_SECRET = 'test-secret'
    mockRespond = vi.fn()
    mockApp = {
      command: vi.fn(),
      action: vi.fn(),
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

  it('should register /seeder-create-channel command and action handlers', () => {
    registerCreateChannelCommand(mockApp as unknown as App)

    expect(mockApp.command).toHaveBeenCalledWith('/seeder-create-channel', expect.any(Function))
    expect(mockApp.action).toHaveBeenCalledWith('confirm_create_channel', expect.any(Function))
    expect(mockApp.action).toHaveBeenCalledWith('cancel_create_channel', expect.any(Function))
  })

  it('should list projects when no input provided', async () => {
    // Mock fetch for listing projects
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ projects: mockProjects }),
    } as Response)
    vi.spyOn(global, 'fetch').mockImplementation(mockFetch)

    registerCreateChannelCommand(mockApp as unknown as App)
    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: { text: '', user_id: 'U123', user_name: 'testuser' },
      ack: vi.fn(),
      respond: mockRespond,
    })

    expect(mockRespond).toHaveBeenCalledWith(
      expect.objectContaining({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: expect.stringContaining('Available Projects'),
            }),
          }),
        ]),
      })
    )
  })

  it('should create channel when high confidence match', async () => {
    // Mock fetch for listing projects and creating channel
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: mockProjects }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false, // AI API fails, fallback to simple match
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          channelId: 'C123456',
          channelName: 'project-my-awesome-project',
        }),
      } as Response)
    vi.spyOn(global, 'fetch').mockImplementation(mockFetch)

    registerCreateChannelCommand(mockApp as unknown as App)
    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: { text: 'My Awesome Project', user_id: 'U123', user_name: 'testuser' },
      ack: vi.fn(),
      respond: mockRespond,
    })

    // Should show success message
    expect(mockRespond).toHaveBeenCalled()
    const respondCall = mockRespond.mock.calls[0][0]
    expect(JSON.stringify(respondCall)).toContain('Channel Created')
  })

  it('should show no match message when project not found', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: mockProjects }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false, // AI API fails
      } as Response)
    vi.spyOn(global, 'fetch').mockImplementation(mockFetch)

    registerCreateChannelCommand(mockApp as unknown as App)
    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: { text: 'nonexistent-project', user_id: 'U123', user_name: 'testuser' },
      ack: vi.fn(),
      respond: mockRespond,
    })

    expect(mockRespond).toHaveBeenCalled()
    const respondCall = mockRespond.mock.calls[0][0]
    expect(JSON.stringify(respondCall)).toContain('Could not find')
  })
})
