'use client'

import { PlanSummary, PlanStatus } from './types'

interface PlanSectionProps {
  plan: PlanSummary
  blockStatus: 'ready' | 'blocked' | 'completed'
  isExpanded: boolean
  isSelected: boolean
  onToggleExpand: () => void
  onSelect: () => void
  onRemove?: () => void
  blockedByPlans: PlanSummary[]
}

const statusConfig: Record<PlanStatus, { label: string; className: string }> = {
  DRAFT: { label: '草稿', className: 'bg-gray-600 text-gray-200' },
  REVIEWING: { label: '审核中', className: 'bg-yellow-600 text-yellow-100' },
  PUBLISHED: { label: '已发布', className: 'bg-green-600 text-green-100' },
  ARCHIVED: { label: '已归档', className: 'bg-purple-600 text-purple-100' },
}

const blockStatusConfig: Record<'ready' | 'blocked' | 'completed', { icon: string; className: string }> = {
  ready: { icon: '●', className: 'text-green-400' },
  blocked: { icon: '◐', className: 'text-yellow-400' },
  completed: { icon: '✓', className: 'text-blue-400' },
}

export function PlanSection({
  plan,
  blockStatus,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelect,
  onRemove,
  blockedByPlans,
}: PlanSectionProps) {
  return (
    <div
      className={`
        border rounded-lg bg-gray-800 overflow-hidden transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-700 hover:border-gray-600'}
      `}
    >
      {/* Plan Header */}
      <div
        className="p-3 cursor-pointer flex items-center justify-between"
        onClick={onSelect}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Block Status Indicator */}
          <span className={`text-sm ${blockStatusConfig[blockStatus].className}`}>
            {blockStatusConfig[blockStatus].icon}
          </span>

          {/* Plan Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white truncate">{plan.name}</h3>
              <span className={`px-1.5 py-0.5 text-xs rounded ${statusConfig[plan.status].className}`}>
                {statusConfig[plan.status].label}
              </span>
            </div>
            {plan.description && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{plan.description}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-400 ml-2">
          <span>{plan.taskCount} tasks</span>
          {plan.totalEstimate !== undefined && plan.totalEstimate > 0 && (
            <span>{plan.totalEstimate}h</span>
          )}

          {/* Expand Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-3 bg-gray-850">
          {/* Dependencies */}
          {blockedByPlans.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Blocked by:</p>
              <div className="flex flex-wrap gap-1">
                {blockedByPlans.map((dep) => (
                  <span
                    key={dep.id}
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      dep.status === 'PUBLISHED' || dep.status === 'ARCHIVED'
                        ? 'bg-green-900/50 text-green-300'
                        : 'bg-yellow-900/50 text-yellow-300'
                    }`}
                  >
                    {dep.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={onSelect}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              View Details →
            </button>
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove from Master Plan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
