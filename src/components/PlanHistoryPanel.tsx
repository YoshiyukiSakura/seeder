'use client'

import { useState, useEffect } from 'react'

interface PlanListItem {
  id: string
  name: string
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
  _count: {
    tasks: number
    conversations: number
  }
}

interface Props {
  projectId: string | undefined
  currentPlanId: string | null
  onSelectPlan: (planId: string) => void
  onNewConversation: () => void
  refreshTrigger?: number  // 用于触发刷新
}

// 格式化相对时间
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function PlanHistoryPanel({
  projectId,
  currentPlanId,
  onSelectPlan,
  onNewConversation,
  refreshTrigger
}: Props) {
  const [plans, setPlans] = useState<PlanListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取计划列表
  useEffect(() => {
    if (!projectId) {
      setPlans([])
      return
    }

    const fetchPlans = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/projects/${projectId}/plans`)
        if (res.ok) {
          const data = await res.json()
          setPlans(data.plans || [])
        } else {
          setError('Failed to load history')
        }
      } catch (e) {
        setError('Failed to load history')
        console.error('Failed to fetch plans:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchPlans()
  }, [projectId, refreshTrigger])

  return (
    <div className="w-64 h-full bg-gray-900 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={onNewConversation}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Conversation
        </button>
      </div>

      {/* Plan List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
          </div>
        )}

        {error && (
          <div className="p-4 text-center text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && plans.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            No conversations yet
          </div>
        )}

        {!loading && !error && plans.map((plan) => {
          const isActive = plan.id === currentPlanId
          return (
            <button
              key={plan.id}
              onClick={() => onSelectPlan(plan.id)}
              className={`w-full text-left p-3 border-b border-gray-800 transition-colors ${
                isActive
                  ? 'bg-blue-600/20 border-l-2 border-l-blue-500'
                  : 'hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-start gap-2">
                {/* Active indicator */}
                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  isActive ? 'bg-blue-500' : 'bg-transparent'
                }`} />

                <div className="flex-1 min-w-0">
                  {/* Plan name */}
                  <p className={`text-sm font-medium truncate ${
                    isActive ? 'text-blue-100' : 'text-gray-200'
                  }`}>
                    {plan.name}
                  </p>

                  {/* Meta info */}
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                    <span>{plan._count.conversations} msgs</span>
                    <span>·</span>
                    <span>{formatRelativeTime(plan.updatedAt)}</span>
                  </p>

                  {/* Status badge */}
                  {plan.status !== 'DRAFT' && (
                    <span className={`inline-block mt-1 px-1.5 py-0.5 text-xs rounded ${
                      plan.status === 'PUBLISHED'
                        ? 'bg-green-900/50 text-green-400'
                        : plan.status === 'REVIEWING'
                        ? 'bg-yellow-900/50 text-yellow-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {plan.status.toLowerCase()}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer - Plan count */}
      {plans.length > 0 && (
        <div className="p-2 border-t border-gray-700 text-center text-xs text-gray-500">
          {plans.length} conversation{plans.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
