'use client'

import { useState, useEffect } from 'react'
import { Task } from '@/components/tasks/types'

interface LinearTeam {
  id: string
  name: string
  key: string
}

interface LinearProject {
  id: string
  name: string
  state: string
}

interface PublishResult {
  success: boolean
  publishedCount: number
  totalCount: number
  issues: Array<{
    taskId: string
    linearIssueId: string
    linearIssueUrl: string
    identifier: string
  }>
  metaIssue?: {
    id: string
    url: string
    identifier: string
  }
  errors: string[]
}

interface PublishDialogProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  planId: string
  planName: string
}

export function PublishDialog({ isOpen, onClose, tasks, planId, planName }: PublishDialogProps) {
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [projects, setProjects] = useState<LinearProject[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [createMetaIssue, setCreateMetaIssue] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PublishResult | null>(null)

  // 加载团队列表
  useEffect(() => {
    if (!isOpen) return

    async function loadTeams() {
      setLoadingTeams(true)
      setError(null)
      try {
        const res = await fetch('/api/linear/teams')
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to load teams')
          return
        }

        setTeams(data.teams || [])
        if (data.teams?.length > 0) {
          setSelectedTeamId(data.teams[0].id)
        }
      } catch {
        setError('Failed to load teams')
      } finally {
        setLoadingTeams(false)
      }
    }

    loadTeams()
  }, [isOpen])

  // 加载项目列表
  useEffect(() => {
    if (!selectedTeamId) {
      setProjects([])
      return
    }

    async function loadProjects() {
      setLoadingProjects(true)
      try {
        const res = await fetch(`/api/linear/teams/${selectedTeamId}/projects`)
        const data = await res.json()

        if (res.ok) {
          setProjects(data.projects || [])
        }
      } catch {
        // 忽略错误，项目是可选的
      } finally {
        setLoadingProjects(false)
      }
    }

    loadProjects()
  }, [selectedTeamId])

  // 任务统计
  const taskStats = {
    total: tasks.length,
    p0: tasks.filter(t => t.priority === 0).length,
    p1: tasks.filter(t => t.priority === 1).length,
    p2: tasks.filter(t => t.priority === 2).length,
    p3: tasks.filter(t => t.priority === 3).length,
    totalHours: tasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0),
  }

  // 发布
  const handlePublish = async () => {
    if (!selectedTeamId) {
      setError('Please select a team')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/plans/${planId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamId,
          projectId: selectedProjectId || undefined,
          createMetaIssue,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to publish')
        return
      }

      setResult(data)
    } catch {
      setError('Failed to publish to Linear')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Publish to Linear</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* 发布成功 */}
          {result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Published Successfully!</span>
                </div>
                <p className="text-gray-300 text-sm">
                  Created {result.publishedCount} of {result.totalCount} issues
                </p>
              </div>

              {/* META Issue */}
              {result.metaIssue && (
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Summary Issue:</p>
                  <a
                    href={result.metaIssue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {result.metaIssue.identifier}
                  </a>
                </div>
              )}

              {/* 已创建的 Issues */}
              <div className="p-3 bg-gray-700/50 rounded-lg max-h-48 overflow-y-auto">
                <p className="text-sm text-gray-400 mb-2">Created Issues:</p>
                <ul className="space-y-1">
                  {result.issues.map((issue) => {
                    const task = tasks.find(t => t.id === issue.taskId)
                    return (
                      <li key={issue.linearIssueId} className="flex items-center gap-2 text-sm">
                        <a
                          href={issue.linearIssueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline font-mono"
                        >
                          {issue.identifier}
                        </a>
                        <span className="text-gray-300 truncate">{task?.title}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-400 mb-1">Errors:</p>
                  <ul className="text-sm text-red-300 space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          )}

          {/* 发布表单 */}
          {!result && (
            <>
              {/* Error - API Key not configured */}
              {error === 'Linear API Key not configured' && (
                <div className="p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-400 mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">Linear API Key Required</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-3">
                    You need to configure your Linear API Key before publishing tasks.
                  </p>
                  <a
                    href="/settings"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Go to Settings
                  </a>
                </div>
              )}

              {/* Other errors */}
              {error && error !== 'Linear API Key not configured' && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* 加载中 */}
              {loadingTeams ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <>
                  {/* Team 选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Team <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => {
                        setSelectedTeamId(e.target.value)
                        setSelectedProjectId('')
                      }}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.key})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Project 选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Project <span className="text-gray-500">(optional)</span>
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      disabled={loadingProjects}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">No project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* META Issue 选项 */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createMetaIssue}
                      onChange={(e) => setCreateMetaIssue(e.target.checked)}
                      className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-gray-300">Create summary issue (META Issue)</span>
                  </label>

                  {/* 任务统计 */}
                  <div className="p-4 bg-gray-700/50 rounded-lg">
                    <h3 className="font-medium text-gray-300 mb-2">Will create {taskStats.total} issues:</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-red-400">P0 (Urgent):</span>
                        <span>{taskStats.p0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-orange-400">P1 (High):</span>
                        <span>{taskStats.p1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-yellow-400">P2 (Medium):</span>
                        <span>{taskStats.p2}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">P3 (Low):</span>
                        <span>{taskStats.p3}</span>
                      </div>
                    </div>
                    {taskStats.totalHours > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-600 text-sm">
                        <span className="text-gray-400">Total estimate:</span>{' '}
                        <span className="text-white">{taskStats.totalHours}h</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!result && !loadingTeams && (
          <div className="p-4 border-t border-gray-700 flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={loading || !selectedTeamId || tasks.length === 0}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {loading && (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              )}
              {loading ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
