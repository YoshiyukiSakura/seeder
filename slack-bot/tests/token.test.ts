/**
 * Tests for Token Generation Library
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateLoginToken } from '../src/lib/token'
import {
  createMockJsonResponse,
  createMockErrorResponse,
} from './utils/mocks'
import { apiResponses } from './utils/fixtures'

// Mock environment
const ORIGINAL_WEB_URL = process.env.WEB_URL
const ORIGINAL_BOT_SECRET = process.env.BOT_SECRET

describe('generateLoginToken', () => {
  beforeEach(() => {
    process.env.WEB_URL = 'http://localhost:3000'
    process.env.BOT_SECRET = 'test-secret'
    vi.clearAllMocks()
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

  it('should call API with correct URL and method', async () => {
    const mockResponse = createMockJsonResponse(apiResponses.token.success)
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await generateLoginToken({
      slackUserId: 'U123',
      slackUsername: 'testuser',
      slackTeamId: 'T456',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/token',
      expect.objectContaining({
        method: 'POST',
      })
    )
  })

  it('should send correct headers including BOT_SECRET', async () => {
    const mockResponse = createMockJsonResponse(apiResponses.token.success)
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await generateLoginToken({
      slackUserId: 'U123',
      slackUsername: 'testuser',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Secret': 'test-secret',
        },
      })
    )
  })

  it('should use default BOT_SECRET when not set', async () => {
    delete process.env.BOT_SECRET

    const mockResponse = createMockJsonResponse(apiResponses.token.success)
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await generateLoginToken({
      slackUserId: 'U123',
      slackUsername: 'testuser',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Secret': 'seedbed-bot-secret',
        },
      })
    )
  })

  it('should send correct body parameters', async () => {
    const mockResponse = createMockJsonResponse(apiResponses.token.success)
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await generateLoginToken({
      slackUserId: 'U123ABC',
      slackUsername: 'johndoe',
      slackTeamId: 'T789XYZ',
    })

    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1]?.body as string)

    expect(body).toEqual({
      slackUserId: 'U123ABC',
      slackUsername: 'johndoe',
      slackTeamId: 'T789XYZ',
    })
  })

  it('should handle optional slackTeamId', async () => {
    const mockResponse = createMockJsonResponse(apiResponses.token.success)
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await generateLoginToken({
      slackUserId: 'U123',
      slackUsername: 'testuser',
      // No slackTeamId
    })

    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1]?.body as string)

    expect(body.slackTeamId).toBeUndefined()
  })

  it('should return token from API response', async () => {
    const mockResponse = createMockJsonResponse({
      token: 'generated-token-xyz',
      expiresAt: '2024-01-01T00:00:00Z',
    })
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    const token = await generateLoginToken({
      slackUserId: 'U123',
      slackUsername: 'testuser',
    })

    expect(token).toBe('generated-token-xyz')
  })

  it('should use default WEB_URL when not set', async () => {
    delete process.env.WEB_URL

    const mockResponse = createMockJsonResponse(apiResponses.token.success)
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await generateLoginToken({
      slackUserId: 'U123',
      slackUsername: 'testuser',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/token',
      expect.anything()
    )
  })

  it('should use custom WEB_URL when set', async () => {
    process.env.WEB_URL = 'https://my-seedbed.example.com'

    const mockResponse = createMockJsonResponse(apiResponses.token.success)
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await generateLoginToken({
      slackUserId: 'U123',
      slackUsername: 'testuser',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://my-seedbed.example.com/api/auth/token',
      expect.anything()
    )
  })

  it('should throw error when API returns error status', async () => {
    const mockResponse = createMockErrorResponse(401, 'Unauthorized')
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await expect(
      generateLoginToken({
        slackUserId: 'U123',
        slackUsername: 'testuser',
      })
    ).rejects.toThrow('Failed to generate token: Unauthorized')
  })

  it('should throw error when API returns 500', async () => {
    const mockResponse = createMockErrorResponse(500, 'Internal Server Error')
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await expect(
      generateLoginToken({
        slackUserId: 'U123',
        slackUsername: 'testuser',
      })
    ).rejects.toThrow('Failed to generate token: Internal Server Error')
  })

  it('should throw error when API returns 400', async () => {
    const mockResponse = createMockErrorResponse(400, 'Missing required field: slackUserId')
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    await expect(
      generateLoginToken({
        slackUserId: '',
        slackUsername: 'testuser',
      })
    ).rejects.toThrow('Failed to generate token: Missing required field: slackUserId')
  })

  it('should throw error when fetch fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

    await expect(
      generateLoginToken({
        slackUserId: 'U123',
        slackUsername: 'testuser',
      })
    ).rejects.toThrow('Network error')
  })
})
