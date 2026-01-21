'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/basePath'

export interface ProjectFormData {
  id?: string
  name: string
  description: string
  gitUrl: string
  gitBranch: string
  techStack: string
  localPath?: string
}

interface ProjectDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (project: ProjectFormData & { id: string }) => void
  mode: 'create' | 'edit'
  initialData?: Partial<ProjectFormData>
}

// 从 Git URL 提取仓库名
function extractRepoName(gitUrl: string): string {
  const cleanUrl = gitUrl.replace(/\.git$/, '')
  if (cleanUrl.includes('@') && cleanUrl.includes(':')) {
    const parts = cleanUrl.split(':')
    const pathPart = parts[parts.length - 1]
    return pathPart.split('/').pop() || ''
  }
  const parts = cleanUrl.split('/')
  return parts.pop() || ''
}

// 将仓库名转换为显示名称
function formatRepoName(repoName: string): string {
  return repoName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function ProjectDialog({
  isOpen,
  onClose,
  onSuccess,
  mode,
  initialData,
}: ProjectDialogProps) {
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    gitUrl: '',
    gitBranch: 'main',
    techStack: '',
    localPath: '',
  })
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Reset form when dialog opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      const hasInitialData = initialData?.name || initialData?.gitUrl || initialData?.localPath
      setFormData({
        id: initialData?.id,
        name: initialData?.name || '',
        description: initialData?.description || '',
        gitUrl: initialData?.gitUrl || '',
        gitBranch: initialData?.gitBranch || 'main',
        techStack: Array.isArray(initialData?.techStack)
          ? initialData.techStack.join(', ')
          : initialData?.techStack || '',
        localPath: initialData?.localPath || '',
      })
      setError(null)
      setShowAdvanced(!!hasInitialData && mode === 'edit')
    }
  }, [isOpen, initialData, mode])

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Auto-extract name from Git URL
  const handleGitUrlChange = (gitUrl: string) => {
    setFormData(prev => {
      const repoName = extractRepoName(gitUrl)
      // 只在 name 为空或是之前自动生成的情况下才更新
      const shouldUpdateName = !prev.name || prev.name === formatRepoName(extractRepoName(prev.gitUrl))
      return {
        ...prev,
        gitUrl,
        name: shouldUpdateName && repoName ? formatRepoName(repoName) : prev.name
      }
    })
  }

  // AI 分析项目
  const handleAnalyze = async () => {
    if (!formData.gitUrl) {
      setError('Please enter a Git URL first')
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      const res = await apiFetch('/api/projects/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gitUrl: formData.gitUrl }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze repository')
      }

      setFormData(prev => ({
        ...prev,
        name: data.name || prev.name,
        description: data.description || prev.description,
        techStack: data.techStack?.join(', ') || prev.techStack,
        gitBranch: data.gitBranch || prev.gitBranch,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.name.trim() && !formData.gitUrl.trim()) {
      setError('Please enter a Git URL or project name')
      return
    }

    // 如果只有 gitUrl，自动填充 name
    if (!formData.name.trim() && formData.gitUrl.trim()) {
      const repoName = extractRepoName(formData.gitUrl)
      formData.name = formatRepoName(repoName)
    }

    setLoading(true)
    setError(null)

    try {
      const techStackArray = formData.techStack
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

      const payload = {
        ...(formData.id ? { id: formData.id } : {}),
        name: formData.name,
        description: formData.description || undefined,
        gitUrl: formData.gitUrl || undefined,
        gitBranch: formData.gitBranch || 'main',
        techStack: techStackArray,
        localPath: formData.localPath || undefined,
      }

      const url = mode === 'edit' && formData.id
        ? `/api/projects/${formData.id}`
        : '/api/projects'

      const res = await apiFetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save project')
      }

      onSuccess(data.project)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const isCreateMode = mode === 'create' && !initialData?.localPath

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {mode === 'create' ? 'New Project' : 'Edit Project'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Git URL - Primary Input for Create Mode */}
          {isCreateMode && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Git URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.gitUrl}
                  onChange={(e) => handleGitUrlChange(e.target.value)}
                  placeholder="git@github.com:owner/repo.git"
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyzing || !formData.gitUrl}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-1.5"
                  title="Auto-fill with AI"
                >
                  {analyzing ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  AI
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                支持 HTTPS、SSH 和自定义 Host 格式 (如 git@github-hanwen:owner/repo.git)。{' '}
                <a
                  href="/docs/projects/from-git"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  了解 SSH Config 配置
                </a>
              </p>
            </div>
          )}

          {/* Name - Auto-filled or manual */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Name {!isCreateMode && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={isCreateMode ? "Auto-filled from Git URL" : "Project name"}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description - Auto-filled by AI */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={isCreateMode ? "Auto-filled by AI analysis" : "Brief project description..."}
              rows={2}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Tech Stack - Auto-filled by AI */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Tech Stack
            </label>
            <input
              type="text"
              value={formData.techStack}
              onChange={(e) => setFormData({ ...formData, techStack: e.target.value })}
              placeholder={isCreateMode ? "Auto-filled by AI analysis" : "React, TypeScript, Node.js"}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Advanced Options Toggle */}
          {(isCreateMode || mode === 'edit') && (
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-300"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Options
            </button>
          )}

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 pl-4 border-l-2 border-gray-700">
              {/* Git URL - For Edit Mode */}
              {!isCreateMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Git URL
                  </label>
                  <input
                    type="text"
                    value={formData.gitUrl}
                    onChange={(e) => setFormData({ ...formData, gitUrl: e.target.value })}
                    placeholder="https://github.com/owner/repo.git"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Git Branch */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Git Branch
                </label>
                <input
                  type="text"
                  value={formData.gitBranch}
                  onChange={(e) => setFormData({ ...formData, gitBranch: e.target.value })}
                  placeholder="main"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Local Path */}
              {(mode === 'edit' || initialData?.localPath) && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Local Path
                  </label>
                  <input
                    type="text"
                    value={formData.localPath}
                    onChange={(e) => setFormData({ ...formData, localPath: e.target.value })}
                    placeholder="/path/to/project"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    readOnly={isCreateMode && !!formData.gitUrl}
                  />
                  {isCreateMode && formData.gitUrl && (
                    <p className="mt-1 text-xs text-gray-500">
                      Path will be auto-generated when cloning.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!formData.name.trim() && !formData.gitUrl.trim())}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  {formData.gitUrl ? 'Cloning...' : 'Saving...'}
                </>
              ) : (
                mode === 'create' ? 'Create Project' : 'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
