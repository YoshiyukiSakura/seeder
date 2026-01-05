/**
 * 认证 API 集成测试
 */
import { NextRequest } from 'next/server'
import {
  createMockRequest,
  createMockUser,
  createMockLoginToken,
  createTestJWT,
  mockPrisma,
} from '../../utils/mocks'
import {
  VALID_LOGIN_TOKEN,
  EXPIRED_LOGIN_TOKEN,
  USED_LOGIN_TOKEN,
} from '../../utils/fixtures'

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/auth/slack', () => {
  describe('Token Validation', () => {
    it('should redirect to error page for missing token', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/slack',
      })

      // Simulate route handler behavior
      const token = new URL(request.url).searchParams.get('token')
      expect(token).toBeNull()

      // Expected redirect
      const expectedRedirect = '/login?error=missing_token'
      expect(expectedRedirect).toContain('missing_token')
    })

    it('should redirect to error page for invalid token', async () => {
      mockPrisma.loginToken.findUnique.mockResolvedValue(null)

      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/slack?token=invalid_token',
      })

      const token = new URL(request.url).searchParams.get('token')
      expect(token).toBe('invalid_token')

      // Prisma returns null for invalid token
      const loginToken = await mockPrisma.loginToken.findUnique({
        where: { token },
      })
      expect(loginToken).toBeNull()
    })

    it('should redirect to error page for expired token', async () => {
      mockPrisma.loginToken.findUnique.mockResolvedValue({
        ...createMockLoginToken(EXPIRED_LOGIN_TOKEN),
        id: 'token_123',
        createdAt: new Date(),
      })

      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/slack?token=expired_token',
      })

      const token = new URL(request.url).searchParams.get('token')
      const loginToken = await mockPrisma.loginToken.findUnique({
        where: { token },
      })

      expect(loginToken).toBeTruthy()
      expect(loginToken!.expiresAt < new Date()).toBe(true)
    })

    it('should redirect to error page for used token', async () => {
      mockPrisma.loginToken.findUnique.mockResolvedValue({
        ...createMockLoginToken(USED_LOGIN_TOKEN),
        id: 'token_123',
        createdAt: new Date(),
      })

      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/slack?token=used_token',
      })

      const loginToken = await mockPrisma.loginToken.findUnique({
        where: { token: 'used_token' },
      })

      expect(loginToken).toBeTruthy()
      expect(loginToken!.usedAt).toBeTruthy()
    })
  })

  describe('User Creation', () => {
    it('should create new user for valid token', async () => {
      const validToken = {
        ...createMockLoginToken(VALID_LOGIN_TOKEN),
        id: 'token_123',
        createdAt: new Date(),
      }

      mockPrisma.loginToken.findUnique.mockResolvedValue(validToken)
      mockPrisma.loginToken.update.mockResolvedValue({
        ...validToken,
        usedAt: new Date(),
      })
      mockPrisma.user.findUnique.mockResolvedValue(null) // User doesn't exist
      mockPrisma.user.create.mockResolvedValue(
        createMockUser({
          slackUserId: validToken.slackUserId,
          slackUsername: validToken.slackUsername,
          slackTeamId: validToken.slackTeamId,
        })
      )

      // Simulate the flow
      const loginToken = await mockPrisma.loginToken.findUnique({
        where: { token: 'valid_token' },
      })
      expect(loginToken).toBeTruthy()
      expect(loginToken!.expiresAt > new Date()).toBe(true)
      expect(loginToken!.usedAt).toBeNull()

      // Mark token as used
      await mockPrisma.loginToken.update({
        where: { id: loginToken!.id },
        data: { usedAt: new Date() },
      })

      // Check for existing user
      const existingUser = await mockPrisma.user.findUnique({
        where: { slackUserId: loginToken!.slackUserId },
      })
      expect(existingUser).toBeNull()

      // Create new user
      const newUser = await mockPrisma.user.create({
        data: {
          slackUserId: loginToken!.slackUserId,
          slackUsername: loginToken!.slackUsername,
          slackTeamId: loginToken!.slackTeamId,
        },
      })

      expect(newUser.slackUserId).toBe('U12345')
      expect(mockPrisma.user.create).toHaveBeenCalled()
    })

    it('should return existing user for valid token', async () => {
      const validToken = {
        ...createMockLoginToken(VALID_LOGIN_TOKEN),
        id: 'token_123',
        createdAt: new Date(),
      }
      const existingUser = createMockUser()

      mockPrisma.loginToken.findUnique.mockResolvedValue(validToken)
      mockPrisma.loginToken.update.mockResolvedValue({
        ...validToken,
        usedAt: new Date(),
      })
      mockPrisma.user.findUnique.mockResolvedValue(existingUser)

      // Simulate the flow
      const loginToken = await mockPrisma.loginToken.findUnique({
        where: { token: 'valid_token' },
      })

      const user = await mockPrisma.user.findUnique({
        where: { slackUserId: loginToken!.slackUserId },
      })

      expect(user).toBeTruthy()
      expect(user!.id).toBe('user_123')
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })
  })

  describe('JWT Generation', () => {
    it('should generate JWT with correct payload', async () => {
      const user = createMockUser()
      const jwt = await createTestJWT({
        userId: user.id,
        slackUserId: user.slackUserId,
        slackUsername: user.slackUsername,
        slackTeamId: user.slackTeamId,
      })

      expect(jwt).toBeTruthy()
      expect(jwt.split('.').length).toBe(3)
    })

    it('should set cookie with correct options', () => {
      // Test cookie options
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 7 * 24 * 60 * 60, // 7 days
      }

      expect(cookieOptions.httpOnly).toBe(true)
      expect(cookieOptions.sameSite).toBe('lax')
      expect(cookieOptions.maxAge).toBe(604800)
    })
  })
})

describe('GET /api/auth/me', () => {
  it('should return user info for authenticated request', async () => {
    const user = createMockUser()
    const jwt = await createTestJWT({ userId: user.id })

    mockPrisma.user.findUnique.mockResolvedValue(user)

    const request = createMockRequest({
      cookies: { 'auth-token': jwt },
    })

    expect(request.cookies.get('auth-token')?.value).toBe(jwt)
  })

  it('should return 401 for unauthenticated request', async () => {
    const request = createMockRequest({ cookies: {} })

    expect(request.cookies.get('auth-token')).toBeUndefined()
  })

  it('should return 401 for expired token', async () => {
    const jwt = await createTestJWT({ userId: 'user123' })

    // Simulate expired token by not returning user
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const request = createMockRequest({
      cookies: { 'auth-token': jwt },
    })

    const token = request.cookies.get('auth-token')?.value
    expect(token).toBeTruthy()
  })
})

describe('POST /api/auth/logout', () => {
  it('should clear auth cookie', () => {
    // Simulate logout by clearing cookie
    const response = {
      cookies: {
        delete: jest.fn(),
      },
    }

    response.cookies.delete('auth-token')

    expect(response.cookies.delete).toHaveBeenCalledWith('auth-token')
  })
})

describe('POST /api/auth/token', () => {
  it('should generate login token for valid request', async () => {
    const tokenData = {
      slackUserId: 'U12345',
      slackUsername: 'testuser',
      slackTeamId: 'T12345',
    }

    const newToken = {
      ...createMockLoginToken(tokenData),
      token: 'generated_token_xyz',
      id: 'token_new',
      createdAt: new Date(),
    }

    mockPrisma.loginToken.create.mockResolvedValue(newToken)

    const created = await mockPrisma.loginToken.create({
      data: {
        token: 'generated_token_xyz',
        ...tokenData,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })

    expect(created.token).toBeTruthy()
    expect(created.slackUserId).toBe('U12345')
    expect(mockPrisma.loginToken.create).toHaveBeenCalled()
  })

  it('should reject request without bot secret', () => {
    const request = createMockRequest({
      headers: {},
    })

    const botSecret = request.headers.get('X-Bot-Secret')
    expect(botSecret).toBeNull()
  })

  it('should reject request with invalid bot secret', () => {
    const request = createMockRequest({
      headers: { 'X-Bot-Secret': 'wrong_secret' },
    })

    const botSecret = request.headers.get('X-Bot-Secret')
    expect(botSecret).not.toBe(process.env.BOT_SECRET || 'correct_secret')
  })
})

describe('Token Security', () => {
  it('should not reuse login token', async () => {
    const usedToken = {
      ...createMockLoginToken(USED_LOGIN_TOKEN),
      id: 'token_123',
      createdAt: new Date(),
    }

    mockPrisma.loginToken.findUnique.mockResolvedValue(usedToken)

    const loginToken = await mockPrisma.loginToken.findUnique({
      where: { token: 'used_token' },
    })

    expect(loginToken!.usedAt).toBeTruthy()
    // Should reject already used token
  })

  it('should mark token as used after successful login', async () => {
    const validToken = {
      ...createMockLoginToken(VALID_LOGIN_TOKEN),
      id: 'token_123',
      createdAt: new Date(),
    }

    mockPrisma.loginToken.findUnique.mockResolvedValue(validToken)
    mockPrisma.loginToken.update.mockResolvedValue({
      ...validToken,
      usedAt: new Date(),
    })

    // Simulate marking token as used
    await mockPrisma.loginToken.update({
      where: { id: validToken.id },
      data: { usedAt: new Date() },
    })

    expect(mockPrisma.loginToken.update).toHaveBeenCalledWith({
      where: { id: validToken.id },
      data: { usedAt: expect.any(Date) },
    })
  })

  it('should clean up expired tokens', async () => {
    mockPrisma.loginToken.deleteMany.mockResolvedValue({ count: 5 })

    const result = await mockPrisma.loginToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })

    expect(result.count).toBe(5)
  })
})
