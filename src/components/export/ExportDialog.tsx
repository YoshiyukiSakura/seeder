'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Task } from '@/components/tasks/types'
import {
  exportToAIPrompt,
  exportToMarkdown,
  exportToJSON,
  copyToClipboard,
  downloadFile,
  type ExportOptions,
  type PlanInfo,
} from '@/lib/export-utils'

type ExportFormat = 'ai-prompt' | 'markdown' | 'json'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  planName?: string
  planDescription?: string
}

export function ExportDialog({
  isOpen,
  onClose,
  tasks,
  planName,
  planDescription,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('ai-prompt')
  const [options, setOptions] = useState<ExportOptions>({
    includeAcceptanceCriteria: true,
    includeRelatedFiles: true,
    priorityFilter: 'all',
  })
  const [preview, setPreview] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)

  const planInfo: PlanInfo = {
    name: planName,
    description: planDescription,
  }

  // Generate preview content
  const generateContent = useCallback(() => {
    switch (format) {
      case 'ai-prompt':
        return exportToAIPrompt(planInfo, tasks, options)
      case 'markdown':
        return exportToMarkdown(planInfo, tasks, options)
      case 'json':
        return exportToJSON(planInfo, tasks, options)
      default:
        return ''
    }
  }, [format, tasks, options, planInfo])

  // Update preview when format or options change
  useEffect(() => {
    if (isOpen) {
      setPreview(generateContent())
    }
  }, [isOpen, generateContent])

  // Reset copy success when format changes
  useEffect(() => {
    setCopySuccess(false)
  }, [format, options])

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

  const handleCopy = async () => {
    const content = generateContent()
    const success = await copyToClipboard(content)
    if (success) {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleDownload = () => {
    const content = generateContent()
    const extensions: Record<ExportFormat, { ext: string; mime: string }> = {
      'ai-prompt': { ext: 'md', mime: 'text/markdown' },
      'markdown': { ext: 'md', mime: 'text/markdown' },
      'json': { ext: 'json', mime: 'application/json' },
    }
    const { ext, mime } = extensions[format]
    const safeName = (planName || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    downloadFile(content, `${safeName}-export.${ext}`, mime)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Export Plan</h2>
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
        <div className="flex-1 overflow-y-auto p-6">
          {/* Format Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Format:</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat('ai-prompt')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  format === 'ai-prompt'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                AI Prompt
              </button>
              <button
                onClick={() => setFormat('markdown')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  format === 'markdown'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Markdown
              </button>
              <button
                onClick={() => setFormat('json')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  format === 'json'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                JSON
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {format === 'ai-prompt' && 'Optimized for Claude Code and Cursor. Includes execution order by dependency phases.'}
              {format === 'markdown' && 'Human-readable format with tables. Good for Notion, documentation, or sharing.'}
              {format === 'json' && 'Machine-readable format. Good for importing into other systems.'}
            </p>
          </div>

          {/* Options */}
          <div className="mb-6 space-y-3">
            <label className="block text-sm font-medium text-gray-300 mb-2">Options:</label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeAcceptanceCriteria}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  includeAcceptanceCriteria: e.target.checked,
                }))}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">Include acceptance criteria</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeRelatedFiles}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  includeRelatedFiles: e.target.checked,
                }))}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">Include related files</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Filter by priority:</span>
              <select
                value={options.priorityFilter}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  priorityFilter: e.target.value === 'all' ? 'all' : parseInt(e.target.value) as 0 | 1 | 2 | 3,
                }))}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All priorities</option>
                <option value="0">P0 - Critical</option>
                <option value="1">P1 - High</option>
                <option value="2">P2 - Medium</option>
                <option value="3">P3 - Low</option>
              </select>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Preview:</label>
            <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
              <pre className="p-4 text-sm text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                {preview}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-850">
          <p className="text-sm text-gray-500">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} will be exported
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                copySuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {copySuccess ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy to Clipboard
                </span>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
