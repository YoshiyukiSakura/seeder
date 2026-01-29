'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/basePath'
import type { Project } from './ProjectSelector'

interface ExtractedProjectInfo {
  suggestedName: string
  displayName: string
  description: string
  techStack: string[]
  conventions?: {
    language?: string
    framework?: string
    codeStyle?: string
    architecture?: string
  }
  keyFeatures?: string[]
}

interface ProjectCreatorDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (project: Project) => void
  planId: string | null
  conversationContent: string
  sourcePath?: string | null  // Start Fresh 模式下 Claude 工作的临时目录
}

export function ProjectCreatorDialog({
  isOpen,
  onClose,
  onSuccess,
  planId,
  conversationContent,
  sourcePath
}: ProjectCreatorDialogProps) {
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [techStack, setTechStack] = useState<string[]>([])
  const [techStackInput, setTechStackInput] = useState('')
  const [createGitHub, setCreateGitHub] = useState(true)
  const [conventions, setConventions] = useState<ExtractedProjectInfo['conventions']>({})
  const [keyFeatures, setKeyFeatures] = useState<string[]>([])

  // Extract project info from conversation
  const extractProjectInfo = useCallback(async () => {
    if (!conversationContent || conversationContent.length < 50) return

    setExtracting(true)
    setError(null)

    try {
      const response = await apiFetch('/api/projects/extract-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationContent })
      })

      if (response.ok) {
        const info: ExtractedProjectInfo = await response.json()
        setName(info.suggestedName || '')
        setDisplayName(info.displayName || '')
        setDescription(info.description || '')
        setTechStack(info.techStack || [])
        setTechStackInput((info.techStack || []).join(', '))
        setConventions(info.conventions || {})
        setKeyFeatures(info.keyFeatures || [])
      } else {
        console.error('Failed to extract project info')
      }
    } catch (err) {
      console.error('Extract error:', err)
    } finally {
      setExtracting(false)
    }
  }, [conversationContent])

  // Auto-extract when dialog opens
  useEffect(() => {
    if (isOpen && conversationContent) {
      extractProjectInfo()
    }
  }, [isOpen, conversationContent, extractProjectInfo])

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setName('')
      setDisplayName('')
      setDescription('')
      setTechStack([])
      setTechStackInput('')
      setCreateGitHub(true)
      setConventions({})
      setKeyFeatures([])
      setError(null)
    }
  }, [isOpen])

  // Handle tech stack input change
  const handleTechStackChange = (value: string) => {
    setTechStackInput(value)
    setTechStack(value.split(',').map(t => t.trim()).filter(Boolean))
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiFetch('/api/projects/create-from-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          name: name.trim(),
          displayName: displayName.trim() || name.trim(),
          description: description.trim(),
          techStack,
          createGitHub,
          conventions,
          keyFeatures,
          sourcePath  // 传递 Start Fresh 的临时目录，用于迁移代码
        })
      })

      if (response.ok) {
        const { project, githubError } = await response.json()

        if (githubError) {
          console.warn('GitHub creation failed:', githubError)
        }

        // Transform to Project type
        const createdProject: Project = {
          id: project.id,
          name: project.name,
          path: project.localPath,
          description: project.description,
          techStack: project.techStack || [],
          source: 'database',
          hasGit: true
        }

        onSuccess(createdProject)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to create project')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Create Project from Conversation</h2>
            <p className="text-sm text-gray-400 mt-1">
              Set up a new project based on your discussion
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {extracting ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-4"></div>
              <p className="text-gray-400">Analyzing conversation...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                  {error}
                </div>
              )}

              {/* Project Name (kebab-case) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Project Name (directory name)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="my-project"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use lowercase letters, numbers, and hyphens only
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="My Project"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of the project..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Tech Stack */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tech Stack
                </label>
                <input
                  type="text"
                  value={techStackInput}
                  onChange={(e) => handleTechStackChange(e.target.value)}
                  placeholder="Next.js, TypeScript, PostgreSQL"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated list of technologies
                </p>
                {techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {techStack.map((tech, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded">
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Key Features */}
              {keyFeatures.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Key Features
                  </label>
                  <div className="space-y-1">
                    {keyFeatures.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-400">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conventions */}
              {conventions && Object.keys(conventions).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Conventions
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {conventions.language && (
                      <div className="text-gray-400">
                        <span className="text-gray-500">Language:</span> {conventions.language}
                      </div>
                    )}
                    {conventions.framework && (
                      <div className="text-gray-400">
                        <span className="text-gray-500">Framework:</span> {conventions.framework}
                      </div>
                    )}
                    {conventions.codeStyle && (
                      <div className="text-gray-400">
                        <span className="text-gray-500">Code Style:</span> {conventions.codeStyle}
                      </div>
                    )}
                    {conventions.architecture && (
                      <div className="text-gray-400">
                        <span className="text-gray-500">Architecture:</span> {conventions.architecture}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* GitHub Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createGitHub}
                    onChange={(e) => setCreateGitHub(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
                <div>
                  <span className="text-sm font-medium text-gray-300">Create GitHub Repository</span>
                  <p className="text-xs text-gray-500">
                    Creates a private GitHub repository and links it to the local repo
                  </p>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between bg-gray-850">
          <button
            onClick={extractProjectInfo}
            disabled={extracting || loading}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Re-analyze
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || extracting || !name.trim()}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Project
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
