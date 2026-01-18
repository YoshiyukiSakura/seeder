/**
 * Jest 测试环境配置
 */

// Polyfill for TextEncoder/TextDecoder in jsdom
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as any

// Polyfill for Web Streams API
import { ReadableStream, WritableStream, TransformStream } from 'stream/web'
global.ReadableStream = ReadableStream as any
global.WritableStream = WritableStream as any
global.TransformStream = TransformStream as any

// Use Node.js native fetch APIs (available in Node 18+)
// These provide Request, Response, Headers, FormData, Blob, File
import { Blob } from 'buffer'

// Polyfill global.Blob with Node's Blob
global.Blob = Blob as any

// FormData polyfill using a simple implementation for tests
class TestFormData {
  private data: Map<string, { value: Blob | string; filename?: string }[]> = new Map()

  append(name: string, value: Blob | string, filename?: string) {
    const existing = this.data.get(name) || []
    existing.push({ value, filename })
    this.data.set(name, existing)
  }

  get(name: string) {
    const values = this.data.get(name)
    return values?.[0]?.value
  }

  getAll(name: string) {
    const values = this.data.get(name) || []
    return values.map(v => {
      if (v.value instanceof Blob && v.filename) {
        // Return a File-like object
        return Object.assign(v.value, {
          name: v.filename,
          lastModified: Date.now(),
        })
      }
      return v.value
    })
  }

  has(name: string) {
    return this.data.has(name)
  }

  delete(name: string) {
    this.data.delete(name)
  }

  entries() {
    return this.data.entries()
  }

  keys() {
    return this.data.keys()
  }

  values() {
    const allValues: (Blob | string)[] = []
    for (const values of this.data.values()) {
      for (const v of values) {
        allValues.push(v.value)
      }
    }
    return allValues[Symbol.iterator]()
  }

  forEach(callback: (value: Blob | string, key: string, parent: TestFormData) => void) {
    for (const [key, values] of this.data.entries()) {
      for (const v of values) {
        callback(v.value, key, this)
      }
    }
  }
}

global.FormData = TestFormData as any

// Simple File class for testing
class TestFile extends Blob {
  name: string
  lastModified: number

  constructor(bits: BlobPart[], name: string, options?: FilePropertyBag) {
    super(bits, options)
    this.name = name
    this.lastModified = options?.lastModified ?? Date.now()
  }
}

global.File = TestFile as any

// Note: Node 18+ has native Request, Response, Headers, and fetch
// We don't need to polyfill them

// Mock 环境变量
process.env.AUTH_SECRET = 'test-secret-key-for-jwt-signing'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/seedbed_test'

// Mock Prisma Client - 在所有测试中使用 mock
jest.mock('@/lib/prisma', () => ({
  prisma: {
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
    $transaction: jest.fn((fn: any) => fn()),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
}))

// Mock Next.js cookies
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

// 扩展 Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },
})

// 类型声明
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R
    }
  }
}
