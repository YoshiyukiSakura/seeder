'use client'

import { memo } from 'react'
import { Handle, Position, type Node } from '@xyflow/react'
import { PlanSummary, PlanStatus } from '../types'

export interface PlanNodeData extends Record<string, unknown> {
  plan: PlanSummary
  onSelect?: (planId: string) => void
  isSelected?: boolean
}

export type PlanNodeType = Node<PlanNodeData, 'planNode'>

interface PlanNodeProps {
  data: PlanNodeData
  selected?: boolean
}

const statusConfig: Record<PlanStatus, { label: string; borderColor: string; bgColor: string }> = {
  DRAFT: {
    label: '草稿',
    borderColor: 'border-gray-500',
    bgColor: 'bg-gray-800',
  },
  REVIEWING: {
    label: '审核中',
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-900/20',
  },
  PUBLISHED: {
    label: '已发布',
    borderColor: 'border-green-500',
    bgColor: 'bg-green-900/20',
  },
  ARCHIVED: {
    label: '已归档',
    borderColor: 'border-purple-500',
    bgColor: 'bg-purple-900/20',
  },
}

function PlanNodeComponent({ data, selected }: PlanNodeProps) {
  const { plan, onSelect, isSelected } = data
  const config = statusConfig[plan.status]

  return (
    <div
      className={`
        w-80 rounded-lg border-2 ${config.borderColor} ${config.bgColor}
        shadow-lg cursor-pointer transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500 shadow-blue-500/30' : 'hover:shadow-xl'}
      `}
      onClick={() => onSelect?.(plan.id)}
    >
      {/* Input Handle (left) - 被其他 Plan 依赖 */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-purple-300"
      />

      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-white truncate flex-1">{plan.name}</h3>
          <span
            className={`
              ml-2 px-2 py-0.5 text-xs rounded-full font-medium
              ${plan.status === 'DRAFT' ? 'bg-gray-600 text-gray-200' : ''}
              ${plan.status === 'REVIEWING' ? 'bg-yellow-600 text-yellow-100' : ''}
              ${plan.status === 'PUBLISHED' ? 'bg-green-600 text-green-100' : ''}
              ${plan.status === 'ARCHIVED' ? 'bg-purple-600 text-purple-100' : ''}
            `}
          >
            {config.label}
          </span>
        </div>
        {plan.description && (
          <p className="text-xs text-gray-400 line-clamp-2">{plan.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <span className="text-gray-300">{plan.taskCount}</span>
          </div>
          {plan.totalEstimate !== undefined && plan.totalEstimate > 0 && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-gray-300">{plan.totalEstimate}h</span>
            </div>
          )}
        </div>

        {/* Dependencies indicator */}
        {plan.blockedByPlanIds.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>{plan.blockedByPlanIds.length}</span>
          </div>
        )}
      </div>

      {/* Output Handle (right) - 依赖其他 Plan */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-purple-300"
      />
    </div>
  )
}

export const PlanNode = memo(PlanNodeComponent)
