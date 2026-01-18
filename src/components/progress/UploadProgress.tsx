'use client'

interface UploadProgressProps {
  files: Array<{
    id: string
    name: string
    progress: number  // 0-100
    status: 'pending' | 'uploading' | 'completed' | 'error'
    error?: string
  }>
  totalProgress: number  // 0-100
}

export function UploadProgress({ files, totalProgress }: UploadProgressProps) {
  if (files.length === 0) return null

  const completedCount = files.filter(f => f.status === 'completed').length
  const hasError = files.some(f => f.status === 'error')

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 mb-3">
      {/* Header with overall progress */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="text-sm text-gray-300">
            Uploading images... ({completedCount}/{files.length})
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {Math.round(totalProgress)}%
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all duration-300 ${
            hasError ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${totalProgress}%` }}
        />
      </div>

      {/* Individual file progress (only show if multiple files) */}
      {files.length > 1 && (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-2">
              {/* Status icon */}
              <div className="w-4 flex-shrink-0">
                {file.status === 'uploading' && (
                  <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
                {file.status === 'completed' && (
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {file.status === 'error' && (
                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
                {file.status === 'pending' && (
                  <div className="w-3 h-3 bg-gray-600 rounded-full" />
                )}
              </div>

              {/* Filename */}
              <span className="text-xs text-gray-400 truncate flex-1 min-w-0" title={file.name}>
                {file.name}
              </span>

              {/* Individual progress bar */}
              <div className="w-20 flex-shrink-0">
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      file.status === 'error' ? 'bg-red-500' :
                      file.status === 'completed' ? 'bg-green-500' : 'bg-blue-400'
                    }`}
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              </div>

              {/* Progress percentage */}
              <span className={`text-xs w-8 text-right flex-shrink-0 ${
                file.status === 'error' ? 'text-red-400' :
                file.status === 'completed' ? 'text-green-400' : 'text-gray-500'
              }`}>
                {file.status === 'error' ? 'Err' : `${Math.round(file.progress)}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {hasError && (
        <div className="mt-2 text-xs text-red-400">
          Some files failed to upload
        </div>
      )}
    </div>
  )
}
