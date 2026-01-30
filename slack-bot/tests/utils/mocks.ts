/**
 * Shared mock factories for Slack Bot tests
 */

import { vi } from 'vitest'
import type { SayFn, App, RespondFn, AckFn, SlashCommand } from '@slack/bolt'
import type { WebClient } from '@slack/web-api'
import type { AppMentionEvent } from '@slack/bolt/dist/types/events/app-mention-event'

/**
 * Create a mock say function
 */
export function createMockSay(): SayFn & { mock: ReturnType<typeof vi.fn>['mock'] } {
  return vi.fn().mockResolvedValue({ ts: '123.456' }) as unknown as SayFn & {
    mock: ReturnType<typeof vi.fn>['mock']
  }
}

/**
 * Create a mock WebClient with chat methods
 */
export function createMockWebClient(): WebClient & {
  chat: {
    postMessage: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
} {
  return {
    chat: {
      postMessage: vi.fn().mockResolvedValue({ ts: '123.789' }),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as WebClient & {
    chat: {
      postMessage: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
    }
  }
}

/**
 * Create a mock Slack App with event/command/action registration
 */
export function createMockApp(): {
  event: ReturnType<typeof vi.fn>
  command: ReturnType<typeof vi.fn>
  action: ReturnType<typeof vi.fn>
} {
  return {
    event: vi.fn(),
    command: vi.fn(),
    action: vi.fn(),
  }
}

/**
 * Create a mock respond function for slash commands
 */
export function createMockRespond(): RespondFn & { mock: ReturnType<typeof vi.fn>['mock'] } {
  return vi.fn().mockResolvedValue(undefined) as unknown as RespondFn & {
    mock: ReturnType<typeof vi.fn>['mock']
  }
}

/**
 * Create a mock ack function
 */
export function createMockAck(): AckFn<void> & { mock: ReturnType<typeof vi.fn>['mock'] } {
  return vi.fn().mockResolvedValue(undefined) as unknown as AckFn<void> & {
    mock: ReturnType<typeof vi.fn>['mock']
  }
}

/**
 * Create a mock app_mention event
 */
export function createMockAppMentionEvent(
  overrides: Partial<AppMentionEvent> = {}
): AppMentionEvent {
  return {
    type: 'app_mention',
    text: '<@U123ABC456> test message',
    channel: 'C123',
    ts: '123.456',
    user: 'U123ABC456',
    event_ts: '123.456',
    ...overrides,
  } as AppMentionEvent
}

/**
 * Create a mock message event (for thread messages)
 */
export function createMockMessageEvent(
  overrides: Partial<{
    ts: string
    thread_ts?: string
    user?: string
    bot_id?: string
    subtype?: string
    app_id?: string
    channel: string
    text: string
  }> = {}
) {
  return {
    type: 'message',
    ts: '123.456',
    channel: 'C123',
    text: 'Test message',
    user: 'U123ABC456',
    ...overrides,
  }
}

/**
 * Create a mock slash command
 */
export function createMockSlashCommand(overrides: Partial<SlashCommand> = {}): SlashCommand {
  return {
    command: '/seeder-login',
    text: '',
    response_url: 'https://hooks.slack.com/commands/xxx',
    trigger_id: 'trigger-123',
    user_id: 'U123ABC456',
    user_name: 'testuser',
    team_id: 'T123',
    team_domain: 'test-team',
    channel_id: 'C123',
    channel_name: 'test-channel',
    api_app_id: 'A123',
    token: 'xxx',
    ...overrides,
  } as SlashCommand
}

/**
 * Create a mock block action event
 */
export function createMockBlockAction(
  overrides: Partial<{
    action_id: string
    block_id: string
    value: string
    user: { id: string; username: string }
    channel: { id: string }
    message: { ts: string; thread_ts?: string }
  }> = {}
) {
  return {
    action: {
      action_id: 'test-action',
      block_id: 'test-block',
      value: 'test-value',
      type: 'button',
      ...overrides,
    },
    user: { id: 'U123ABC456', username: 'testuser', ...overrides.user },
    channel: { id: 'C123', ...overrides.channel },
    message: { ts: '123.456', ...overrides.message },
  }
}

/**
 * Create a mock SSE response stream
 */
export function createMockSSEResponse(
  events: Array<{ type: string; data: unknown }>
): Response {
  const encoder = new TextEncoder()

  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        events.forEach((event) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        })
        controller.close()
      },
    }),
  } as unknown as Response
}

/**
 * Create a mock failed response
 */
export function createMockErrorResponse(status: number, errorText?: string): Response {
  return {
    ok: false,
    status,
    text: async () => errorText || `HTTP Error ${status}`,
    json: async () => ({ error: errorText || `HTTP Error ${status}` }),
    body: null,
  } as unknown as Response
}

/**
 * Create a mock fetch function
 */
export function createMockFetch(response: Response): typeof global.fetch {
  return vi.fn().mockResolvedValue(response) as unknown as typeof global.fetch
}

/**
 * Create a mock JSON response
 */
export function createMockJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    body: null,
  } as unknown as Response
}
