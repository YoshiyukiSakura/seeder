/**
 * Upload utility unit tests
 */
import type { UploadFileProgress, UploadProgressCallback, UploadResult } from '@/lib/upload'
import { uploadFilesWithProgress } from '@/lib/upload'

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  public status: number = 200
  public responseText: string = ''
  public withCredentials: boolean = false
  public readyState: number = 0

  private listeners: Record<string, ((event?: any) => void)[]> = {}
  private uploadListeners: Record<string, ((event?: any) => void)[]> = {}

  public upload = {
    addEventListener: (event: string, callback: (event?: any) => void) => {
      if (!this.uploadListeners[event]) {
        this.uploadListeners[event] = []
      }
      this.uploadListeners[event].push(callback)
    }
  }

  addEventListener(event: string, callback: (event?: any) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  open(_method: string, _url: string) {
    // Record the request details
  }

  send(_data: any) {
    // Simulate async behavior
  }

  // Helper methods for testing
  simulateProgress(loaded: number, total: number) {
    const event = { lengthComputable: true, loaded, total }
    this.uploadListeners['progress']?.forEach(cb => cb(event))
  }

  simulateLoad() {
    this.readyState = 4
    this.listeners['load']?.forEach(cb => cb())
  }

  simulateError() {
    this.listeners['error']?.forEach(cb => cb())
  }

  simulateAbort() {
    this.listeners['abort']?.forEach(cb => cb())
  }
}

// Store the mock instance for testing
let mockXHR: MockXMLHttpRequest

beforeEach(() => {
  mockXHR = new MockXMLHttpRequest()
  global.XMLHttpRequest = jest.fn(() => mockXHR) as any
})

describe('Upload utility types', () => {
  it('should define UploadFileProgress interface correctly', () => {
    const progress: UploadFileProgress = {
      id: 'file-1-12345',
      name: 'test.jpg',
      progress: 50,
      status: 'uploading',
    }

    expect(progress.id).toBe('file-1-12345')
    expect(progress.name).toBe('test.jpg')
    expect(progress.progress).toBe(50)
    expect(progress.status).toBe('uploading')
  })

  it('should support all upload status values', () => {
    const statuses: UploadFileProgress['status'][] = ['pending', 'uploading', 'completed', 'error']

    statuses.forEach(status => {
      const progress: UploadFileProgress = {
        id: 'test',
        name: 'test.jpg',
        progress: 0,
        status,
      }
      expect(progress.status).toBe(status)
    })
  })

  it('should support optional error field', () => {
    const progressWithError: UploadFileProgress = {
      id: 'file-1',
      name: 'test.jpg',
      progress: 0,
      status: 'error',
      error: 'Upload failed',
    }

    expect(progressWithError.error).toBe('Upload failed')
  })

  it('should define UploadResult interface correctly', () => {
    const successResult: UploadResult = {
      paths: ['/tmp/uploads/test1.jpg', '/tmp/uploads/test2.png'],
    }

    expect(successResult.paths).toHaveLength(2)
    expect(successResult.paths[0]).toContain('/tmp/uploads/')
  })

  it('should support optional warnings in UploadResult', () => {
    const resultWithWarnings: UploadResult = {
      paths: ['/tmp/uploads/test.jpg'],
      warnings: ['Some warning message'],
    }

    expect(resultWithWarnings.warnings).toHaveLength(1)
  })

  it('should support optional error in UploadResult', () => {
    const errorResult: UploadResult = {
      paths: [],
      error: 'All files failed',
    }

    expect(errorResult.paths).toHaveLength(0)
    expect(errorResult.error).toBe('All files failed')
  })
})

describe('Upload progress calculation', () => {
  it('should calculate total progress from individual file progress', () => {
    const files: UploadFileProgress[] = [
      { id: '1', name: 'file1.jpg', progress: 100, status: 'completed' },
      { id: '2', name: 'file2.jpg', progress: 50, status: 'uploading' },
      { id: '3', name: 'file3.jpg', progress: 0, status: 'pending' },
    ]

    const totalProgress = files.reduce((sum, f) => sum + f.progress, 0) / files.length
    expect(totalProgress).toBe(50) // (100 + 50 + 0) / 3
  })

  it('should identify completed files', () => {
    const files: UploadFileProgress[] = [
      { id: '1', name: 'file1.jpg', progress: 100, status: 'completed' },
      { id: '2', name: 'file2.jpg', progress: 100, status: 'completed' },
      { id: '3', name: 'file3.jpg', progress: 50, status: 'uploading' },
    ]

    const completedCount = files.filter(f => f.status === 'completed').length
    expect(completedCount).toBe(2)
  })

  it('should detect if any file has error', () => {
    const filesWithError: UploadFileProgress[] = [
      { id: '1', name: 'file1.jpg', progress: 100, status: 'completed' },
      { id: '2', name: 'file2.jpg', progress: 0, status: 'error', error: 'Too large' },
    ]

    const hasError = filesWithError.some(f => f.status === 'error')
    expect(hasError).toBe(true)

    const filesWithoutError: UploadFileProgress[] = [
      { id: '1', name: 'file1.jpg', progress: 100, status: 'completed' },
      { id: '2', name: 'file2.jpg', progress: 50, status: 'uploading' },
    ]

    const noError = filesWithoutError.some(f => f.status === 'error')
    expect(noError).toBe(false)
  })
})

describe('Progress callback behavior', () => {
  it('should support progress callback function type', () => {
    const callback: UploadProgressCallback = jest.fn()

    callback({
      files: [{ id: '1', name: 'test.jpg', progress: 50, status: 'uploading' }],
      totalProgress: 50,
    })

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      totalProgress: 50,
    }))
  })

  it('should update progress multiple times during upload', () => {
    const callback: UploadProgressCallback = jest.fn()

    // Simulate progress updates
    callback({ files: [{ id: '1', name: 'test.jpg', progress: 0, status: 'pending' }], totalProgress: 0 })
    callback({ files: [{ id: '1', name: 'test.jpg', progress: 25, status: 'uploading' }], totalProgress: 25 })
    callback({ files: [{ id: '1', name: 'test.jpg', progress: 50, status: 'uploading' }], totalProgress: 50 })
    callback({ files: [{ id: '1', name: 'test.jpg', progress: 75, status: 'uploading' }], totalProgress: 75 })
    callback({ files: [{ id: '1', name: 'test.jpg', progress: 100, status: 'completed' }], totalProgress: 100 })

    expect(callback).toHaveBeenCalledTimes(5)
  })
})

describe('uploadFilesWithProgress function', () => {
  it('should resolve with empty paths for empty file array', async () => {
    const callback = jest.fn()
    const result = await uploadFilesWithProgress([], callback)

    expect(result).toEqual({ paths: [] })
    expect(callback).not.toHaveBeenCalled()
  })

  it('should initialize file progress and transition to uploading status', async () => {
    const callback = jest.fn()
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    // Start the upload (don't await yet)
    const uploadPromise = uploadFilesWithProgress([mockFile], callback)

    // The implementation transitions from pending to uploading immediately
    // First call reports the initial state (pending), second call reports uploading
    // Since the transition happens synchronously, we check that uploading status was reached
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      files: expect.arrayContaining([
        expect.objectContaining({
          name: 'test.jpg',
          progress: 0,
          status: 'uploading'
        })
      ]),
      totalProgress: 0
    }))

    // Simulate successful upload
    mockXHR.status = 200
    mockXHR.responseText = JSON.stringify({ paths: ['/tmp/uploads/test.jpg'] })
    mockXHR.simulateLoad()

    await uploadPromise
  })

  it('should transition to uploading status after initialization', async () => {
    const callback = jest.fn()
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    const uploadPromise = uploadFilesWithProgress([mockFile], callback)

    // Second call should have uploading status
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      files: expect.arrayContaining([
        expect.objectContaining({
          status: 'uploading'
        })
      ])
    }))

    mockXHR.status = 200
    mockXHR.responseText = JSON.stringify({ paths: ['/tmp/uploads/test.jpg'] })
    mockXHR.simulateLoad()

    await uploadPromise
  })

  it('should report progress during upload', async () => {
    const callback = jest.fn()
    const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })

    const uploadPromise = uploadFilesWithProgress([mockFile], callback)

    // Simulate progress events
    mockXHR.simulateProgress(50, 100) // 50%

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      files: expect.arrayContaining([
        expect.objectContaining({
          progress: 50
        })
      ]),
      totalProgress: 50
    }))

    mockXHR.simulateProgress(100, 100) // 100%

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      totalProgress: 100
    }))

    mockXHR.status = 200
    mockXHR.responseText = JSON.stringify({ paths: ['/tmp/uploads/test.jpg'] })
    mockXHR.simulateLoad()

    await uploadPromise
  })

  it('should handle successful upload', async () => {
    const callback = jest.fn()
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    const uploadPromise = uploadFilesWithProgress([mockFile], callback)

    mockXHR.status = 200
    mockXHR.responseText = JSON.stringify({
      paths: ['/tmp/uploads/test.jpg'],
      warnings: ['Some warning']
    })
    mockXHR.simulateLoad()

    const result = await uploadPromise

    expect(result.paths).toEqual(['/tmp/uploads/test.jpg'])
    expect(result.warnings).toEqual(['Some warning'])
    expect(result.error).toBeUndefined()

    // Final callback should have completed status
    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0]
    expect(lastCall.files[0].status).toBe('completed')
    expect(lastCall.files[0].progress).toBe(100)
  })

  it('should handle HTTP error response', async () => {
    const callback = jest.fn()
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    const uploadPromise = uploadFilesWithProgress([mockFile], callback)

    mockXHR.status = 400
    mockXHR.responseText = JSON.stringify({ error: 'File too large' })
    mockXHR.simulateLoad()

    const result = await uploadPromise

    expect(result.paths).toEqual([])
    expect(result.error).toBe('File too large')

    // Callback should have error status
    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0]
    expect(lastCall.files[0].status).toBe('error')
    expect(lastCall.files[0].error).toBe('File too large')
  })

  it('should handle network error', async () => {
    const callback = jest.fn()
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    const uploadPromise = uploadFilesWithProgress([mockFile], callback)

    mockXHR.simulateError()

    const result = await uploadPromise

    expect(result.paths).toEqual([])
    expect(result.error).toBe('Network error')

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0]
    expect(lastCall.files[0].status).toBe('error')
    expect(lastCall.files[0].error).toBe('Network error')
  })

  it('should handle upload abort', async () => {
    const callback = jest.fn()
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    const uploadPromise = uploadFilesWithProgress([mockFile], callback)

    mockXHR.simulateAbort()

    const result = await uploadPromise

    expect(result.paths).toEqual([])
    expect(result.error).toBe('Upload cancelled')

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0]
    expect(lastCall.files[0].status).toBe('error')
    expect(lastCall.files[0].error).toBe('Upload cancelled')
  })

  it('should handle invalid JSON response', async () => {
    const callback = jest.fn()
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    const uploadPromise = uploadFilesWithProgress([mockFile], callback)

    mockXHR.status = 200
    mockXHR.responseText = 'not valid json'
    mockXHR.simulateLoad()

    const result = await uploadPromise

    expect(result.paths).toEqual([])
    expect(result.error).toBe('Invalid response from server')

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0]
    expect(lastCall.files[0].status).toBe('error')
    expect(lastCall.files[0].error).toBe('Invalid response')
  })

  it('should upload multiple files', async () => {
    const callback = jest.fn()
    const mockFile1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
    const mockFile2 = new File(['test2'], 'test2.png', { type: 'image/png' })

    const uploadPromise = uploadFilesWithProgress([mockFile1, mockFile2], callback)

    // Initial call should have both files
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      files: expect.arrayContaining([
        expect.objectContaining({ name: 'test1.jpg' }),
        expect.objectContaining({ name: 'test2.png' })
      ])
    }))

    mockXHR.status = 200
    mockXHR.responseText = JSON.stringify({
      paths: ['/tmp/uploads/test1.jpg', '/tmp/uploads/test2.png']
    })
    mockXHR.simulateLoad()

    const result = await uploadPromise

    expect(result.paths).toHaveLength(2)
  })

  it('should set withCredentials to true', async () => {
    const callback = jest.fn()
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    const uploadPromise = uploadFilesWithProgress([mockFile], callback)

    expect(mockXHR.withCredentials).toBe(true)

    mockXHR.status = 200
    mockXHR.responseText = JSON.stringify({ paths: ['/tmp/uploads/test.jpg'] })
    mockXHR.simulateLoad()

    await uploadPromise
  })

  it('should generate unique file IDs', async () => {
    const callback = jest.fn()
    const mockFile1 = new File(['test1'], 'test.jpg', { type: 'image/jpeg' })
    const mockFile2 = new File(['test2'], 'test.jpg', { type: 'image/jpeg' })

    const uploadPromise = uploadFilesWithProgress([mockFile1, mockFile2], callback)

    const firstCall = callback.mock.calls[0][0]
    const file1Id = firstCall.files[0].id
    const file2Id = firstCall.files[1].id

    expect(file1Id).not.toBe(file2Id)
    expect(file1Id).toMatch(/^file-0-\d+$/)
    expect(file2Id).toMatch(/^file-1-\d+$/)

    mockXHR.status = 200
    mockXHR.responseText = JSON.stringify({ paths: [] })
    mockXHR.simulateLoad()

    await uploadPromise
  })
})
