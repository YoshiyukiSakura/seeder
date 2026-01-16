/**
 * Prisma Client Mock
 */

export const PrismaClient = jest.fn().mockImplementation(() => ({
  user: {
    findUnique: jest.fn(),
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
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  conversation: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn((fn: any) => fn()),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
}))

// Mock types
export type User = {
  id: string
  slackUserId: string
  slackUsername: string
  slackTeamId: string | null
  email: string | null
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export type Project = {
  id: string
  name: string
  description: string | null
  userId: string
  gitUrl: string | null
  gitBranch: string | null
  localPath: string | null
  techStack: string[]
  conventions: any
  createdAt: Date
  updatedAt: Date
}

export type Plan = {
  id: string
  projectId: string
  name: string
  description: string | null
  status: string
  sessionId: string | null
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type Task = {
  id: string
  planId: string
  title: string
  description: string
  priority: number
  labels: string[]
  acceptanceCriteria: string[]
  relatedFiles: string[]
  estimateHours: number | null
  sortOrder: number
  dependsOnId: string | null
  createdAt: Date
  updatedAt: Date
}

export type LoginToken = {
  id: string
  token: string
  slackUserId: string
  slackUsername: string
  slackTeamId: string | null
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

export type Conversation = {
  id: string
  planId: string
  role: string
  content: string
  metadata: any
  createdAt: Date
}

export const PlanStatus = {
  DRAFT: 'DRAFT',
  REVIEWING: 'REVIEWING',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
}
