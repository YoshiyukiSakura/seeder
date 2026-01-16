'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/basePath'
import { MasterPlanListItem, MasterPlanStatus } from './types'

interface Props {
  projectId: string | undefined
  currentMasterPlanId: string | null
  currentPlanId: string | null
  onSelectMasterPlan: (masterPlanId: string) => void
  onSelectPlan: (planId: string) => void
  onNewMasterPlan: () => void
  onNewConversation: () => void
  refreshTrigger?: number
}

interface PlanListItem {
  id: string
  name: string
  status: string
  createdAt: string
  updatedAt: string
  masterPlanId: string | null
  _count: {
    tasks: number
    conversations: number
  }
}

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

const statusConfig: Record<MasterPlanStatus, { label: string; className: string }> = {
  DRAFT: { label: 'draft', className: 'bg-gray-700 text-gray-400' },
  REVIEWING: { label: 'reviewing', className: 'bg-yellow-900/50 text-yellow-400' },
  PUBLISHED: { label: 'published', className: 'bg-green-900/50 text-green-400' },
  ARCHIVED: { label: 'archived', className: 'bg-purple-900/50 text-purple-400' },
}

export function MasterPlanHistoryPanel({
  projectId,
  currentMasterPlanId,
  currentPlanId,
  onSelectMasterPlan,
  onSelectPlan,
  onNewMasterPlan,
  onNewConversation,
  refreshTrigger,
}: Props) {
  const [masterPlans, setMasterPlans] = useState<MasterPlanListItem[]>([])
  const [independentPlans, setIndependentPlans] = useState<PlanListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'masterplans' | 'plans'>('masterplans')

  // 获取 MasterPlan 列表
  useEffect(() => {
    if (!projectId) {
      setMasterPlans([])
      setIndependentPlans([])
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        // 并行获取 MasterPlan 和独立 Plan
        const [masterPlansRes, plansRes] = await Promise.all([
          apiFetch(`/api/projects/${projectId}/masterplans`),
          apiFetch(`/api/projects/${projectId}/plans`),
        ])

        if (masterPlansRes.ok) {
          const data = await masterPlansRes.json()
          setMasterPlans(data.masterPlans || [])
        }

        if (plansRes.ok) {
          const data = await plansRes.json()
          // 过滤出没有 masterPlanId 的独立 Plan
          const plans = (data.plans || []) as PlanListItem[]
          setIndependentPlans(plans.filter((p) => !p.masterPlanId))
        }
      } catch (e) {
        setError('Failed to load data')
        console.error('Failed to fetch data:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId, refreshTrigger])

  return (
    <div className="w-64 h-full bg-gray-900 border-r border-gray-700 flex flex-col">
      {/* Header - Action Buttons */}
      <div className="p-3 border-b border-gray-700 space-y-2">
        <button
          onClick={onNewConversation}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Plan
        </button>
        <button
          onClick={onNewMasterPlan}
          className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          New Master Plan
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('masterplans')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'masterplans'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Master Plans ({masterPlans.length})
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'plans'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Plans ({independentPlans.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
          </div>
        )}

        {error && <div className="p-4 text-center text-red-400 text-sm">{error}</div>}

        {!loading && !error && activeTab === 'masterplans' && (
          <>
            {masterPlans.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No master plans yet</div>
            ) : (
              masterPlans.map((mp) => {
                const isActive = mp.id === currentMasterPlanId
                const config = statusConfig[mp.status as MasterPlanStatus]
                return (
                  <button
                    key={mp.id}
                    onClick={() => onSelectMasterPlan(mp.id)}
                    className={`w-full text-left p-3 border-b border-gray-800 transition-colors ${
                      isActive ? 'bg-purple-600/20 border-l-2 border-l-purple-500' : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-purple-500' : 'bg-transparent'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isActive ? 'text-purple-100' : 'text-gray-200'
                          }`}
                        >
                          {mp.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          <span>{mp.planCount} plans</span>
                          <span>.</span>
                          <span>{formatRelativeTime(mp.updatedAt)}</span>
                        </p>
                        {mp.status !== 'DRAFT' && (
                          <span className={`inline-block mt-1 px-1.5 py-0.5 text-xs rounded ${config.className}`}>
                            {config.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </>
        )}

        {!loading && !error && activeTab === 'plans' && (
          <>
            {independentPlans.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No independent plans</div>
            ) : (
              independentPlans.map((plan) => {
                const isActive = plan.id === currentPlanId
                return (
                  <button
                    key={plan.id}
                    onClick={() => onSelectPlan(plan.id)}
                    className={`w-full text-left p-3 border-b border-gray-800 transition-colors ${
                      isActive ? 'bg-blue-600/20 border-l-2 border-l-blue-500' : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-blue-500' : 'bg-transparent'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isActive ? 'text-blue-100' : 'text-gray-200'
                          }`}
                        >
                          {plan.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          <span>{plan._count.conversations} msgs</span>
                          <span>.</span>
                          <span>{formatRelativeTime(plan.updatedAt)}</span>
                        </p>
                        {plan.status !== 'DRAFT' && (
                          <span
                            className={`inline-block mt-1 px-1.5 py-0.5 text-xs rounded ${
                              plan.status === 'PUBLISHED'
                                ? 'bg-green-900/50 text-green-400'
                                : plan.status === 'REVIEWING'
                                  ? 'bg-yellow-900/50 text-yellow-400'
                                  : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {plan.status.toLowerCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </>
        )}
      </div>
    </div>
  )
}
