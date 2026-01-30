/**
 * Tests for Login Command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { App } from '@slack/bolt'
import { registerLoginCommand } from '../src/commands/login'
import {
  createMockApp,
  createMockSlashCommand,
  createMockRespond,
  createMockAck,
} from './utils/mocks'

// Mock environment
const ORIGINAL_WEB_URL = process.env.WEB_URL

// Mock generateLoginToken
vi.mock('../src/lib/token', () => ({
  generateLoginToken: vi.fn(),
}))

describe('registerLoginCommand', () => {
  let mockApp: ReturnType<typeof createMockApp>
  let mockRespond: ReturnType<typeof createMockRespond>
  let mockAck: ReturnType<typeof createMockAck>

  beforeEach(() => {
    process.env.WEB_URL = 'http://localhost:3000'
    mockApp = createMockApp()
    mockRespond = createMockRespond()
    mockAck = createMockAck()
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

  it('should register /seeder-login command handler', () => {
    registerLoginCommand(mockApp as unknown as App)

    expect(mockApp.command).toHaveBeenCalledWith('/seeder-login', expect.any(Function))
  })

  it('should acknowledge command immediately', async () => {
    const { generateLoginToken } = await import('../src/lib/token')
    vi.mocked(generateLoginToken).mockResolvedValue('test-token-123')

    registerLoginCommand(mockApp as unknown as App)
    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: createMockSlashCommand(),
      ack: mockAck,
      respond: mockRespond,
    })

    expect(mockAck).toHaveBeenCalledTimes(1)
    // ack should be called before respond
    expect(mockAck.mock.invocationCallOrder[0]).toBeLessThan(
      mockRespond.mock.invocationCallOrder[0]
    )
  })

  it('should generate login link with correct token', async () => {
    const { generateLoginToken } = await import('../src/lib/token')
    vi.mocked(generateLoginToken).mockResolvedValue('test-token-abc')

    registerLoginCommand(mockApp as unknown as App)
    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: createMockSlashCommand({
        user_id: 'U123',
        user_name: 'testuser',
        team_id: 'T456',
      }),
      ack: mockAck,
      respond: mockRespond,
    })

    // Check generateLoginToken was called with correct params
    expect(generateLoginToken).toHaveBeenCalledWith({
      slackUserId: 'U123',
      slackUsername: 'testuser',
      slackTeamId: 'T456',
    })

    // Check respond was called with ephemeral message
    expect(mockRespond).toHaveBeenCalledTimes(1)
    const respondCall = mockRespond.mock.calls[0][0]
    expect(respondCall.response_type).toBe('ephemeral')
    expect(respondCall.blocks).toBeDefined()

    // Check login URL in button
    const actionsBlock = respondCall.blocks.find((b: { type: string }) => b.type === 'actions')
    expect(actionsBlock).toBeDefined()
    const button = actionsBlock.elements[0]
    expect(button.url).toBe('http://localhost:3000/auth?token=test-token-abc')
  })

  it('should use custom WEB_URL when set', async () => {
    process.env.WEB_URL = 'https://my-seedbed.example.com'

    const { generateLoginToken } = await import('../src/lib/token')
    vi.mocked(generateLoginToken).mockResolvedValue('custom-token')

    registerLoginCommand(mockApp as unknown as App)
    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: createMockSlashCommand(),
      ack: mockAck,
      respond: mockRespond,
    })

    const respondCall = mockRespond.mock.calls[0][0]
    const actionsBlock = respondCall.blocks.find((b: { type: string }) => b.type === 'actions')
    const button = actionsBlock.elements[0]
    expect(button.url).toBe('https://my-seedbed.example.com/auth?token=custom-token')
  })

  it('should include username in welcome message', async () => {
    const { generateLoginToken } = await import('../src/lib/token')
    vi.mocked(generateLoginToken).mockResolvedValue('token-123')

    registerLoginCommand(mockApp as unknown as App)
    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: createMockSlashCommand({
        user_name: 'johndoe',
      }),
      ack: mockAck,
      respond: mockRespond,
    })

    const respondCall = mockRespond.mock.calls[0][0]
    const sectionBlock = respondCall.blocks.find((b: { type: string }) => b.type === 'section')
    expect(sectionBlock.text.text).toContain('Hi johndoe')
  })

  it('should send error message when token generation fails', async () => {
    const { generateLoginToken } = await import('../src/lib/token')
    vi.mocked(generateLoginToken).mockRejectedValue(new Error('Token service unavailable'))

    // Suppress console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    registerLoginCommand(mockApp as unknown as App)
    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: createMockSlashCommand(),
      ack: mockAck,
      respond: mockRespond,
    })

    // ack should still be called
    expect(mockAck).toHaveBeenCalledTimes(1)

    // respond should be called with error message
    expect(mockRespond).toHaveBeenCalledTimes(1)
    const respondCall = mockRespond.mock.calls[0][0]
    expect(respondCall.response_type).toBe('ephemeral')
    expect(respondCall.text).toContain('Failed to generate login link')
    expect(respondCall.text).toContain('Token service unavailable')

    consoleErrorSpy.mockRestore()
  })

  it('should send generic error message for non-Error exceptions', async () => {
    const { generateLoginToken } = await import('../src/lib/token')
    vi.mocked(generateLoginToken).mockRejectedValue('string error')

    // Suppress console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    registerLoginCommand(mockApp as unknown as App)
    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: createMockSlashCommand(),
      ack: mockAck,
      respond: mockRespond,
    })

    const respondCall = mockRespond.mock.calls[0][0]
    expect(respondCall.text).toContain('Unknown error')

    consoleErrorSpy.mockRestore()
  })

  it('should include button with correct styling', async () => {
    const { generateLoginToken } = await import('../src/lib/token')
    vi.mocked(generateLoginToken).mockResolvedValue('token-123')

    registerLoginCommand(mockApp as unknown as App)
    const commandHandler = mockApp.command.mock.calls[0][1]

    await commandHandler({
      command: createMockSlashCommand(),
      ack: mockAck,
      respond: mockRespond,
    })

    const respondCall = mockRespond.mock.calls[0][0]
    const actionsBlock = respondCall.blocks.find((b: { type: string }) => b.type === 'actions')
    const button = actionsBlock.elements[0]

    expect(button.type).toBe('button')
    expect(button.text.text).toBe('Open Seeder')
    expect(button.style).toBe('primary')
  })
})
