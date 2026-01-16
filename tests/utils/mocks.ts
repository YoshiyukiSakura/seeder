/**
 * 测试 Mock 工具
 */
import { Task } from '@/components/tasks/types'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'

// ============ Mock 数据工厂 ============

export function createMockUser(overrides: Partial<{
  id: string
  slackUserId: string
  slackUsername: string
  slackTeamId: string | null
  email: string | null
  avatarUrl: string | null
}> = {}) {
  return {
    id: 'user_123',
    slackUserId: 'U12345',
    slackUsername: 'testuser',
    slackTeamId: 'T12345',
    email: 'test@example.com',
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createMockProject(overrides: Partial<{
  id: string
  name: string
  description: string | null
  userId: string
}> = {}) {
  return {
    id: 'proj_123',
    name: 'Test Project',
    description: 'A test project',
    userId: 'user_123',
    gitUrl: null,
    gitBranch: 'main',
    localPath: null,
    techStack: [],
    conventions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createMockPlan(overrides: Partial<{
  id: string
  name: string
  description: string | null
  projectId: string
  status: string
  sessionId: string | null
}> = {}) {
  return {
    id: 'plan_123',
    name: 'Test Plan',
    description: 'A test plan',
    projectId: 'proj_123',
    status: 'DRAFT',
    sessionId: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task_${Math.random().toString(36).slice(2, 9)}`,
    title: 'Test Task',
    description: 'A test task description',
    priority: 2,
    labels: [],
    acceptanceCriteria: [],
    relatedFiles: [],
    estimateHours: undefined,
    sortOrder: 0,
    dependsOnId: null,
    ...overrides,
  }
}

export function createMockLoginToken(overrides: Partial<{
  id: string
  token: string
  slackUserId: string
  slackUsername: string
  slackTeamId: string | null
  expiresAt: Date
  usedAt: Date | null
}> = {}) {
  return {
    id: 'token_123',
    token: 'mock_token_abc123',
    slackUserId: 'U12345',
    slackUsername: 'testuser',
    slackTeamId: 'T12345',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

// ============ JWT 工具 ============

const AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-key-for-jwt-signing'

export async function createTestJWT(payload: {
  userId: string
  slackUserId?: string
  slackUsername?: string
  slackTeamId?: string | null
}) {
  const secret = new TextEncoder().encode(AUTH_SECRET)
  return await new SignJWT({
    userId: payload.userId,
    slackUserId: payload.slackUserId || 'U12345',
    slackUsername: payload.slackUsername || 'testuser',
    slackTeamId: payload.slackTeamId || 'T12345',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(secret)
}

export async function createExpiredJWT(payload: {
  userId: string
}) {
  const secret = new TextEncoder().encode(AUTH_SECRET)
  return await new SignJWT({
    userId: payload.userId,
    slackUserId: 'U12345',
    slackUsername: 'testuser',
    slackTeamId: 'T12345',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('-1h') // 过期 1 小时
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200) // 2 小时前签发
    .sign(secret)
}

// ============ Request Mock ============

export function createMockRequest(options: {
  method?: string
  url?: string
  cookies?: Record<string, string>
  headers?: Record<string, string>
  body?: unknown
} = {}): NextRequest {
  const { method = 'GET', url = 'http://localhost:3000', cookies = {}, headers = {}, body } = options

  const request = new NextRequest(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  })

  // Mock cookies
  const mockCookies = {
    get: jest.fn((name: string) => cookies[name] ? { value: cookies[name] } : undefined),
    getAll: jest.fn(() => Object.entries(cookies).map(([name, value]) => ({ name, value }))),
    has: jest.fn((name: string) => name in cookies),
    set: jest.fn(),
    delete: jest.fn(),
  }

  Object.defineProperty(request, 'cookies', {
    get: () => mockCookies,
  })

  return request
}

// ============ Claude CLI Mock ============

export function createMockClaudeSSEEvents() {
  return [
    { type: 'init', data: { cwd: '/test/project', useContinue: false } },
    { type: 'init', data: { tools: 15 } },
    { type: 'text', data: { content: 'I\'ll help you create a plan...' } },
    { type: 'tool', data: { name: 'Read' } },
    { type: 'text', data: { content: '\n\n## 任务 1: [P0] 创建数据模型\n**描述**: 设计数据库模型\n' } },
    { type: 'result', data: { content: '计划已完成' } },
    { type: 'done', data: {} },
  ]
}

export function createMockQuestionEvent() {
  return {
    type: 'question',
    data: {
      toolUseId: 'tool_use_123',
      questions: [
        {
          question: '你想使用哪种认证方式？',
          header: '认证方式',
          options: [
            { label: 'JWT', description: '使用 JSON Web Token' },
            { label: 'Session', description: '使用服务端会话' },
            { label: 'OAuth', description: '使用第三方 OAuth' },
          ],
          multiSelect: false,
        },
      ],
    },
  }
}

// ============ Prisma Mock ============

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mockPrisma: Record<string, any> = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  plan: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  task: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  loginToken: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  conversation: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrisma)),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
}

// Mock prisma module
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))
