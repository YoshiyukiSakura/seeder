import { basePath } from './basePath'

export interface UploadFileProgress {
  id: string
  name: string
  progress: number  // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
}

export interface UploadProgressCallback {
  (progress: {
    files: UploadFileProgress[]
    totalProgress: number
  }): void
}

export interface UploadResult {
  paths: string[]
  warnings?: string[]
  error?: string
}

/**
 * Upload files with progress tracking using XMLHttpRequest
 */
export function uploadFilesWithProgress(
  files: File[],
  onProgress: UploadProgressCallback
): Promise<UploadResult> {
  return new Promise((resolve) => {
    if (files.length === 0) {
      resolve({ paths: [] })
      return
    }

    // Initialize file progress tracking
    const fileProgress: UploadFileProgress[] = files.map((file, index) => ({
      id: `file-${index}-${Date.now()}`,
      name: file.name,
      progress: 0,
      status: 'pending' as const
    }))

    // Report initial state
    onProgress({
      files: fileProgress,
      totalProgress: 0
    })

    // Create FormData
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    // Mark all files as uploading
    fileProgress.forEach(fp => {
      fp.status = 'uploading'
    })
    onProgress({
      files: [...fileProgress],
      totalProgress: 0
    })

    // Create XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100

        // Update all files proportionally (since we're uploading as a batch)
        fileProgress.forEach(fp => {
          fp.progress = percentComplete
        })

        onProgress({
          files: [...fileProgress],
          totalProgress: percentComplete
        })
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)

          // Mark all files as completed
          fileProgress.forEach(fp => {
            fp.status = 'completed'
            fp.progress = 100
          })
          onProgress({
            files: [...fileProgress],
            totalProgress: 100
          })

          resolve({
            paths: response.paths || [],
            warnings: response.warnings
          })
        } catch {
          // Parse error
          fileProgress.forEach(fp => {
            fp.status = 'error'
            fp.error = 'Invalid response'
          })
          onProgress({
            files: [...fileProgress],
            totalProgress: 100
          })
          resolve({ paths: [], error: 'Invalid response from server' })
        }
      } else {
        // HTTP error
        let errorMessage = 'Upload failed'
        try {
          const response = JSON.parse(xhr.responseText)
          errorMessage = response.error || errorMessage
        } catch {
          // Ignore parse errors
        }

        fileProgress.forEach(fp => {
          fp.status = 'error'
          fp.error = errorMessage
        })
        onProgress({
          files: [...fileProgress],
          totalProgress: 100
        })
        resolve({ paths: [], error: errorMessage })
      }
    })

    xhr.addEventListener('error', () => {
      fileProgress.forEach(fp => {
        fp.status = 'error'
        fp.error = 'Network error'
      })
      onProgress({
        files: [...fileProgress],
        totalProgress: 100
      })
      resolve({ paths: [], error: 'Network error' })
    })

    xhr.addEventListener('abort', () => {
      fileProgress.forEach(fp => {
        fp.status = 'error'
        fp.error = 'Upload cancelled'
      })
      onProgress({
        files: [...fileProgress],
        totalProgress: 100
      })
      resolve({ paths: [], error: 'Upload cancelled' })
    })

    // Open and send request
    const url = `${basePath}/api/images/upload`
    xhr.open('POST', url)

    // Include credentials for authentication
    xhr.withCredentials = true

    xhr.send(formData)
  })
}
