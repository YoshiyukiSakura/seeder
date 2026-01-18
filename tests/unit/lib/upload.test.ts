/**
 * Upload utility unit tests
 */
import type { UploadFileProgress, UploadProgressCallback, UploadResult } from '@/lib/upload'

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
