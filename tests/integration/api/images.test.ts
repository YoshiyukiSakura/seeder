/**
 * 图片上传 API 集成测试
 */
import { POST } from '@/app/api/images/upload/route'
import { NextRequest } from 'next/server'
import { existsSync } from 'fs'
import { mkdir, rm, readdir } from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads')

// Helper to create a mock file with arrayBuffer support
function createMockFile(
  name: string,
  content: string,
  type: string
): File {
  const blob = new Blob([content], { type })
  const file = new File([blob], name, { type })

  // Add arrayBuffer method since jsdom's File doesn't implement it properly
  const contentBuffer = new TextEncoder().encode(content).buffer
  file.arrayBuffer = async () => contentBuffer

  return file
}

// Helper to create multipart form request
function createUploadRequest(files: File[]): NextRequest {
  const formData = new FormData()
  files.forEach(file => formData.append('images', file))

  return new NextRequest('http://localhost:3000/api/images/upload', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/images/upload', () => {
  beforeAll(async () => {
    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }
  })

  afterAll(async () => {
    // Clean up uploaded files after all tests
    if (existsSync(UPLOAD_DIR)) {
      const files = await readdir(UPLOAD_DIR)
      for (const file of files) {
        await rm(path.join(UPLOAD_DIR, file))
      }
    }
  })

  describe('successful uploads', () => {
    it('should upload a single image', async () => {
      const file = createMockFile('test.png', 'fake png content', 'image/png')
      const request = createUploadRequest([file])

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.paths).toHaveLength(1)
      expect(data.count).toBe(1)
      expect(data.paths[0]).toContain('.png')
      expect(existsSync(data.paths[0])).toBe(true)
    })

    it('should upload multiple images', async () => {
      const files = [
        createMockFile('image1.jpg', 'fake jpg 1', 'image/jpeg'),
        createMockFile('image2.png', 'fake png 2', 'image/png'),
        createMockFile('image3.gif', 'fake gif 3', 'image/gif'),
      ]
      const request = createUploadRequest(files)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.paths).toHaveLength(3)
      expect(data.count).toBe(3)

      // Verify all files exist
      for (const filePath of data.paths) {
        expect(existsSync(filePath)).toBe(true)
      }
    })

    it('should handle webp images', async () => {
      const file = createMockFile('test.webp', 'fake webp content', 'image/webp')
      const request = createUploadRequest([file])

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.paths[0]).toContain('.webp')
    })

    it('should handle svg images', async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>'
      const file = createMockFile('test.svg', svgContent, 'image/svg+xml')
      const request = createUploadRequest([file])

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.paths[0]).toContain('.svg')
    })
  })

  describe('file validation', () => {
    it('should reject non-image files', async () => {
      const file = createMockFile('test.txt', 'text content', 'text/plain')
      const request = createUploadRequest([file])

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('No valid images were uploaded')
      expect(data.details.some((d: string) => d.includes('Invalid file type: text/plain'))).toBe(true)
    })

    it('should reject PDF files', async () => {
      const file = createMockFile('test.pdf', 'fake pdf', 'application/pdf')
      const request = createUploadRequest([file])

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.details.some((d: string) => d.includes('Invalid file type: application/pdf'))).toBe(true)
    })

    it('should accept valid images and report invalid ones in warnings', async () => {
      const files = [
        createMockFile('valid.png', 'fake png', 'image/png'),
        createMockFile('invalid.txt', 'text', 'text/plain'),
      ]
      const request = createUploadRequest(files)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.paths).toHaveLength(1)
      expect(data.warnings).toBeDefined()
      expect(data.warnings.some((w: string) => w.includes('Invalid file type: text/plain'))).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should return error when no files provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/images/upload', {
        method: 'POST',
        body: new FormData(),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('No images provided')
    })

    it('should return error when wrong field name used', async () => {
      const formData = new FormData()
      const file = createMockFile('test.png', 'fake png', 'image/png')
      formData.append('files', file) // Wrong field name

      const request = new NextRequest('http://localhost:3000/api/images/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('No images provided')
    })
  })

  describe('file naming', () => {
    it('should generate unique filenames', async () => {
      const file1 = createMockFile('same.png', 'content1', 'image/png')
      const file2 = createMockFile('same.png', 'content2', 'image/png')

      const request1 = createUploadRequest([file1])
      const request2 = createUploadRequest([file2])

      const response1 = await POST(request1)
      const response2 = await POST(request2)

      const data1 = await response1.json()
      const data2 = await response2.json()

      expect(data1.paths[0]).not.toBe(data2.paths[0])
    })

    it('should preserve correct file extension', async () => {
      const jpegFile = createMockFile('test.jpeg', 'fake jpeg', 'image/jpeg')
      const request = createUploadRequest([jpegFile])

      const response = await POST(request)
      const data = await response.json()

      expect(data.paths[0]).toContain('.jpg')
    })
  })
})
