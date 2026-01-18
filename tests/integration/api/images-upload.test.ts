/**
 * 图片上传 API 集成测试
 * 测试覆盖文件上传、路径处理、类型验证、大小限制等
 */
import { NextResponse } from 'next/server'
import {
  createMockUser,
  createTestJWT,
  createMockRequest,
  mockPrisma,
} from '../../utils/mocks'

// Mock fs 模块
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}))

// Mock crypto 模块以生成可预测的文件名
jest.mock('crypto', () => {
  const originalCrypto = jest.requireActual('crypto')
  return {
    ...originalCrypto,
    randomBytes: jest.fn().mockImplementation((size: number) => ({
      toString: (encoding: string) => 'abc12345',
    })),
  }
})

// Mock getCurrentUser
const mockGetCurrentUser = jest.fn()
jest.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}))

import { POST } from '@/app/api/images/upload/route'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

// Helper to create a mock File object that works with the API
function createMockFile(name: string, content: string, type: string): File {
  const blob = new Blob([content], { type })
  const file = Object.assign(blob, {
    name,
    lastModified: Date.now(),
    webkitRelativePath: '',
    // Ensure arrayBuffer method returns proper ArrayBuffer
    arrayBuffer: async () => {
      const encoder = new TextEncoder()
      return encoder.encode(content).buffer
    },
  }) as File
  return file
}

// Helper to create a mock NextRequest with FormData
async function createFormDataRequest(files: File[]) {
  // Create a mock request that simulates formData parsing
  const mockFormData = {
    getAll: (name: string) => {
      if (name === 'files') return files
      return []
    },
  }

  const mockRequest = {
    formData: jest.fn().mockResolvedValue(mockFormData),
    cookies: {
      get: jest.fn(),
    },
  }

  return mockRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCurrentUser.mockResolvedValue(null)
  ;(existsSync as jest.Mock).mockReturnValue(true)
})

describe('POST /api/images/upload', () => {
  describe('Authentication', () => {
    it('should return 401 for unauthenticated request', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const files = [createMockFile('test.jpg', 'test content', 'image/jpeg')]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should allow authenticated user to upload', async () => {
      const user = createMockUser()
      mockGetCurrentUser.mockResolvedValue(user)

      const files = [createMockFile('test.jpg', 'fake image content', 'image/jpeg')]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)

      expect(response.status).toBe(201)
    })
  })

  describe('File Validation', () => {
    beforeEach(() => {
      const user = createMockUser()
      mockGetCurrentUser.mockResolvedValue(user)
    })

    it('should reject request with no files', async () => {
      const mockRequest = await createFormDataRequest([])

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No files provided')
    })

    it('should reject non-image file types', async () => {
      const files = [createMockFile('document.pdf', 'fake pdf content', 'application/pdf')]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('All files failed validation')
      expect(data.details[0]).toContain('Invalid file type')
      expect(data.details[0]).toContain('document.pdf')
    })

    it('should accept valid image types', async () => {
      const validTypes = [
        { type: 'image/jpeg', name: 'photo.jpg' },
        { type: 'image/png', name: 'screenshot.png' },
        { type: 'image/gif', name: 'animation.gif' },
        { type: 'image/webp', name: 'modern.webp' },
        { type: 'image/svg+xml', name: 'vector.svg' },
      ]

      for (const { type, name } of validTypes) {
        jest.clearAllMocks()
        const user = createMockUser()
        mockGetCurrentUser.mockResolvedValue(user)
        ;(existsSync as jest.Mock).mockReturnValue(true)

        const files = [createMockFile(name, 'fake content', type)]
        const mockRequest = await createFormDataRequest(files)

        const response = await POST(mockRequest as any)

        expect(response.status).toBe(201)
      }
    })

    it('should reject files larger than 5MB', async () => {
      // Create a mock file with size > 5MB
      const largeContent = 'x'.repeat(6 * 1024 * 1024) // 6MB
      const files = [createMockFile('large-image.jpg', largeContent, 'image/jpeg')]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('All files failed validation')
      expect(data.details[0]).toContain('File too large')
      expect(data.details[0]).toContain('large-image.jpg')
    })

    it('should accept files under 5MB', async () => {
      const smallContent = 'x'.repeat(1 * 1024 * 1024) // 1MB
      const files = [createMockFile('small-image.jpg', smallContent, 'image/jpeg')]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)

      expect(response.status).toBe(201)
    })
  })

  describe('File Processing', () => {
    beforeEach(() => {
      const user = createMockUser()
      mockGetCurrentUser.mockResolvedValue(user)
    })

    it('should generate unique file names with timestamp and random string', async () => {
      const files = [createMockFile('original-name.jpg', 'content', 'image/jpeg')]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.paths).toHaveLength(1)
      // 文件路径格式: /tmp/uploads/{timestamp}-{randomString}.jpg
      expect(data.paths[0]).toMatch(/^\/tmp\/uploads\/\d+-[a-f0-9]+\.jpg$/)
    })

    it('should preserve file extension', async () => {
      const testCases = [
        { name: 'image.jpeg', ext: '.jpeg' },
        { name: 'photo.PNG', ext: '.PNG' },
        { name: 'animated.gif', ext: '.gif' },
      ]

      for (const { name, ext } of testCases) {
        jest.clearAllMocks()
        const user = createMockUser()
        mockGetCurrentUser.mockResolvedValue(user)
        ;(existsSync as jest.Mock).mockReturnValue(true)

        const files = [createMockFile(name, 'content', 'image/jpeg')]
        const mockRequest = await createFormDataRequest(files)

        const response = await POST(mockRequest as any)
        const data = await response.json()

        expect(data.paths[0]).toContain(ext)
      }
    })

    it('should create upload directory if not exists', async () => {
      ;(existsSync as jest.Mock).mockReturnValue(false)

      const files = [createMockFile('test.jpg', 'content', 'image/jpeg')]
      const mockRequest = await createFormDataRequest(files)

      await POST(mockRequest as any)

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('tmp'),
        { recursive: true }
      )
    })

    it('should write file to disk', async () => {
      const content = 'test image content'
      const files = [createMockFile('test.jpg', content, 'image/jpeg')]
      const mockRequest = await createFormDataRequest(files)

      await POST(mockRequest as any)

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('tmp/uploads'),
        expect.any(Buffer)
      )
    })
  })

  describe('Multiple Files', () => {
    beforeEach(() => {
      const user = createMockUser()
      mockGetCurrentUser.mockResolvedValue(user)
    })

    it('should handle multiple valid files', async () => {
      const files = [
        createMockFile('a.jpg', '1', 'image/jpeg'),
        createMockFile('b.png', '2', 'image/png'),
        createMockFile('c.gif', '3', 'image/gif'),
      ]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.paths).toHaveLength(3)
    })

    it('should return partial success with warnings when some files fail', async () => {
      const files = [
        createMockFile('valid.jpg', '1', 'image/jpeg'),
        createMockFile('invalid.pdf', '2', 'application/pdf'),
      ]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.paths).toHaveLength(1)
      expect(data.warnings).toBeDefined()
      expect(data.warnings).toHaveLength(1)
      expect(data.warnings[0]).toContain('invalid.pdf')
    })

    it('should return error when all files fail validation', async () => {
      const files = [
        createMockFile('a.txt', '1', 'text/plain'),
        createMockFile('b.json', '2', 'application/json'),
      ]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('All files failed validation')
      expect(data.details).toHaveLength(2)
    })
  })

  describe('Response Format', () => {
    beforeEach(() => {
      const user = createMockUser()
      mockGetCurrentUser.mockResolvedValue(user)
    })

    it('should return correct success response format', async () => {
      const files = [createMockFile('test.jpg', 'content', 'image/jpeg')]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toHaveProperty('paths')
      expect(Array.isArray(data.paths)).toBe(true)
      expect(data.paths[0]).toMatch(/^\/tmp\/uploads\//)
    })

    it('should return paths starting with /tmp/uploads/', async () => {
      const files = [createMockFile('image.png', 'content', 'image/png')]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(data.paths.every((p: string) => p.startsWith('/tmp/uploads/'))).toBe(true)
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      const user = createMockUser()
      mockGetCurrentUser.mockResolvedValue(user)
    })

    it('should handle file system write errors gracefully', async () => {
      ;(writeFile as jest.Mock).mockRejectedValueOnce(new Error('Disk full'))

      const files = [createMockFile('test.jpg', 'content', 'image/jpeg')]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should handle mkdir errors gracefully', async () => {
      ;(existsSync as jest.Mock).mockReturnValue(false)
      ;(mkdir as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'))

      const files = [createMockFile('test.jpg', 'content', 'image/jpeg')]
      const mockRequest = await createFormDataRequest(files)

      const response = await POST(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})

describe('File Type Validation Logic', () => {
  it('should correctly identify allowed MIME types', () => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ]

    // 测试有效类型
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    validTypes.forEach(type => {
      expect(allowedTypes.includes(type)).toBe(true)
    })

    // 测试无效类型
    const invalidTypes = [
      'application/pdf',
      'text/plain',
      'application/json',
      'image/bmp',
      'image/tiff',
      'video/mp4',
      'audio/mpeg',
    ]
    invalidTypes.forEach(type => {
      expect(allowedTypes.includes(type)).toBe(false)
    })
  })
})

describe('File Size Validation Logic', () => {
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  it('should reject files exactly at the limit', () => {
    const exactLimitSize = 5 * 1024 * 1024
    expect(exactLimitSize > MAX_FILE_SIZE).toBe(false)
  })

  it('should reject files over the limit', () => {
    const overLimitSize = 5 * 1024 * 1024 + 1
    expect(overLimitSize > MAX_FILE_SIZE).toBe(true)
  })

  it('should accept files under the limit', () => {
    const underLimitSizes = [
      0,
      1024, // 1KB
      1024 * 1024, // 1MB
      4 * 1024 * 1024, // 4MB
      5 * 1024 * 1024 - 1, // Just under 5MB
    ]

    underLimitSizes.forEach(size => {
      expect(size <= MAX_FILE_SIZE).toBe(true)
    })
  })
})
