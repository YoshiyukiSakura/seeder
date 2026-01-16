'use client'

import { useState } from 'react'
import { MasterPlan, PlanSummary, MasterPlanStatus } from './types'
import { PlanSection } from './PlanSection'

interface MasterPlanViewProps {
  masterPlan: MasterPlan
  onPlanSelect?: (planId: string) => void
  onStatusChange?: (status: MasterPlanStatus) => void
  onAddPlan?: () => void
  onRemovePlan?: (planId: string) => void
  onUpdatePlanOrder?: (plans: Array<{ id: string; sortOrder: number }>) => void
  onUpdatePlanDependencies?: (planId: string, blockedByPlanIds: string[]) => void
  selectedPlanId?: string | null
}

const statusConfig: Record<MasterPlanStatus, { label: string; className: string }> = {
  DRAFT: { label: '草稿', className: 'bg-gray-600 text-gray-200' },
  REVIEWING: { label: '审核中', className: 'bg-yellow-600 text-yellow-100' },
  PUBLISHED: { label: '已发布', className: 'bg-green-600 text-green-100' },
  ARCHIVED: { label: '已归档', className: 'bg-purple-600 text-purple-100' },
}

export function MasterPlanView({
  masterPlan,
  onPlanSelect,
  onStatusChange,
  onAddPlan,
  onRemovePlan,
  onUpdatePlanOrder,
  onUpdatePlanDependencies,
  selectedPlanId,
}: MasterPlanViewProps) {
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(new Set())

  const togglePlanExpand = (planId: string) => {
    setExpandedPlanIds((prev) => {
      const next = new Set(prev)
      if (next.has(planId)) {
        next.delete(planId)
      } else {
        next.add(planId)
      }
      return next
    })
  }

  // 按依赖关系分组 Plan（无依赖的在前）
  const sortedPlans = [...masterPlan.plans].sort((a, b) => a.sortOrder - b.sortOrder)

  // 计算总体统计
  const totalTasks = masterPlan.plans.reduce((sum, p) => sum + p.taskCount, 0)
  const totalEstimate = masterPlan.plans.reduce((sum, p) => sum + (p.totalEstimate || 0), 0)

  // 获取 Plan 的阻塞状态
  const getPlanBlockStatus = (plan: PlanSummary): 'ready' | 'blocked' | 'completed' => {
    if (plan.status === 'PUBLISHED' || plan.status === 'ARCHIVED') {
      return 'completed'
    }
    if (plan.blockedByPlanIds.length === 0) {
      return 'ready'
    }
    // 检查所有依赖是否已完成
    const allDepsCompleted = plan.blockedByPlanIds.every((depId) => {
      const dep = masterPlan.plans.find((p) => p.id === depId)
      return dep && (dep.status === 'PUBLISHED' || dep.status === 'ARCHIVED')
    })
    return allDepsCompleted ? 'ready' : 'blocked'
  }

  return (
    <div className="flex flex-col h-full bg-gray-850">
      {/* Header */}
      <header className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">{masterPlan.name}</h2>
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${statusConfig[masterPlan.status].className}`}>
            {statusConfig[masterPlan.status].label}
          </span>
        </div>
        {masterPlan.description && (
          <p className="text-sm text-gray-400 mb-3">{masterPlan.description}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{masterPlan.plans.length} plans</span>
          <span>{totalTasks} tasks</span>
          {totalEstimate > 0 && <span>{totalEstimate}h total</span>}
        </div>
      </header>

      {/* Plan List */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedPlans.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">No plans added yet</p>
            {onAddPlan && (
              <button
                onClick={onAddPlan}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Plan
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedPlans.map((plan) => (
              <PlanSection
                key={plan.id}
                plan={plan}
                blockStatus={getPlanBlockStatus(plan)}
                isExpanded={expandedPlanIds.has(plan.id)}
                isSelected={selectedPlanId === plan.id}
                onToggleExpand={() => togglePlanExpand(plan.id)}
                onSelect={() => onPlanSelect?.(plan.id)}
                onRemove={onRemovePlan ? () => onRemovePlan(plan.id) : undefined}
                blockedByPlans={plan.blockedByPlanIds
                  .map((id) => masterPlan.plans.find((p) => p.id === id))
                  .filter((p): p is PlanSummary => p !== undefined)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <footer className="p-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          {onAddPlan && (
            <button
              onClick={onAddPlan}
              className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              + Add Plan
            </button>
          )}
          {masterPlan.status === 'DRAFT' && onStatusChange && (
            <button
              onClick={() => onStatusChange('PUBLISHED')}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              disabled={masterPlan.plans.length === 0}
            >
              Publish Master Plan
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
