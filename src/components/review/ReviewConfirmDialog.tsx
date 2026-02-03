'use client'

import { useState, useEffect } from 'react'

export interface ReviewResult {
  reviewId: string
  score?: number
  summary?: string
  concerns?: string[]
  suggestions?: string[]
  raw?: string
  parseError?: string
}

interface ReviewConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onSendFeedback: (feedback: string) => void
  reviewResult: ReviewResult | null
  isLoading?: boolean
  streamingContent?: string
}

export function ReviewConfirmDialog({
  isOpen,
  onClose,
  onSendFeedback,
  reviewResult,
  isLoading = false,
  streamingContent = ''
}: ReviewConfirmDialogProps) {
  const [feedbackText, setFeedbackText] = useState('')
  const [showRaw, setShowRaw] = useState(false)

  // 当评审结果更新时，自动生成默认反馈
  useEffect(() => {
    if (reviewResult && !reviewResult.parseError) {
      const defaultFeedback = generateDefaultFeedback(reviewResult)
      setFeedbackText(defaultFeedback)
    }
  }, [reviewResult])

  if (!isOpen) return null

  const handleSend = () => {
    if (feedbackText.trim()) {
      onSendFeedback(feedbackText)
    }
  }

  // 渲染分数颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-2xl">K</span>
            Kimi Review
            {isLoading && (
              <span className="text-sm text-gray-400 animate-pulse">
                (Analyzing...)
              </span>
            )}
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Streaming content while loading */}
          {isLoading && streamingContent && (
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                {streamingContent}
              </p>
            </div>
          )}

          {/* Loading placeholder */}
          {isLoading && !streamingContent && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-400">Kimi is reviewing the plan...</p>
            </div>
          )}

          {/* Review result */}
          {reviewResult && !isLoading && (
            <>
              {/* Parse error fallback */}
              {reviewResult.parseError && (
                <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3">
                  <p className="text-yellow-400 text-sm mb-2">
                    Note: Could not parse structured review. Showing raw output.
                  </p>
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
                    {reviewResult.raw || streamingContent || 'No output received'}
                  </pre>
                </div>
              )}

              {/* Score */}
              {typeof reviewResult.score === 'number' && (
                <div className="flex items-center gap-4">
                  <span className="text-gray-400">Score:</span>
                  <span className={`text-3xl font-bold ${getScoreColor(reviewResult.score)}`}>
                    {reviewResult.score}
                  </span>
                  <span className="text-gray-500">/100</span>
                </div>
              )}

              {/* Summary */}
              {reviewResult.summary && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Summary</h3>
                  <p className="text-white">{reviewResult.summary}</p>
                </div>
              )}

              {/* Concerns */}
              {reviewResult.concerns && reviewResult.concerns.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-1">
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Concerns ({reviewResult.concerns.length})
                  </h3>
                  <ul className="space-y-1">
                    {reviewResult.concerns.map((concern, idx) => (
                      <li key={idx} className="text-orange-300 text-sm pl-4 border-l-2 border-orange-500">
                        {concern}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggestions */}
              {reviewResult.suggestions && reviewResult.suggestions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-1">
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Suggestions ({reviewResult.suggestions.length})
                  </h3>
                  <ul className="space-y-1">
                    {reviewResult.suggestions.map((suggestion, idx) => (
                      <li key={idx} className="text-blue-300 text-sm pl-4 border-l-2 border-blue-500">
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Raw output toggle */}
              {reviewResult.raw && !reviewResult.parseError && (
                <div>
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1"
                  >
                    <svg className={`w-4 h-4 transition-transform ${showRaw ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    {showRaw ? 'Hide' : 'Show'} raw output
                  </button>
                  {showRaw && (
                    <pre className="mt-2 text-xs text-gray-400 whitespace-pre-wrap font-mono bg-gray-900 p-2 rounded max-h-40 overflow-y-auto">
                      {reviewResult.raw}
                    </pre>
                  )}
                </div>
              )}

              {/* Feedback editor */}
              <div className="pt-4 border-t border-gray-700">
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  Feedback to send to Claude (edit if needed)
                </h3>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="w-full h-32 bg-gray-700 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter feedback to send to Claude..."
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            {isLoading ? 'Cancel' : 'Ignore'}
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !feedbackText.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send to Claude
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 根据评审结果生成默认反馈文本
 */
function generateDefaultFeedback(result: ReviewResult): string {
  const lines: string[] = []

  lines.push('## Kimi Review Feedback')
  lines.push('')

  if (typeof result.score === 'number') {
    lines.push(`**Score: ${result.score}/100**`)
    lines.push('')
  }

  if (result.summary) {
    lines.push(`**Summary:** ${result.summary}`)
    lines.push('')
  }

  if (result.concerns && result.concerns.length > 0) {
    lines.push('### Concerns to Address:')
    result.concerns.forEach((concern, idx) => {
      lines.push(`${idx + 1}. ${concern}`)
    })
    lines.push('')
  }

  if (result.suggestions && result.suggestions.length > 0) {
    lines.push('### Suggestions:')
    result.suggestions.forEach((suggestion, idx) => {
      lines.push(`${idx + 1}. ${suggestion}`)
    })
    lines.push('')
  }

  lines.push('---')
  lines.push('Please review the feedback above and update the plan accordingly.')

  return lines.join('\n')
}

export default ReviewConfirmDialog
