'use client'

import { Task } from './types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface TaskCardProps {
  task: Task
  isSelected?: boolean
  onSelect?: (taskId: string) => void
  isDragging?: boolean
}

const priorityColors: Record<number, string> = {
  0: 'border-red-500 bg-red-900/20',
  1: 'border-orange-500 bg-orange-900/20',
  2: 'border-yellow-500 bg-yellow-900/20',
  3: 'border-gray-500 bg-gray-900/20',
}

const priorityLabels = ['P0', 'P1', 'P2', 'P3']

// 执行状态配置
const executionStatusConfig: Record<string, { label: string; className: string; icon?: string }> = {
  PENDING: { label: '待执行', className: 'bg-gray-600 text-gray-200' },
  WAITING_DEPS: { label: '等待依赖', className: 'bg-purple-600 text-purple-100' },
  RUNNING: { label: '执行中', className: 'bg-blue-600 text-blue-100 animate-pulse' },
  COMPLETED: { label: '已完成', className: 'bg-green-600 text-green-100' },
  FAILED: { label: '失败', className: 'bg-red-600 text-red-100' },
  SKIPPED: { label: '跳过', className: 'bg-yellow-600 text-yellow-100' },
}

export function TaskCard({ task, isSelected, onSelect, isDragging }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        border-l-4 ${priorityColors[task.priority] || priorityColors[2]}
        rounded-lg p-3 mb-3 bg-gray-800 cursor-pointer
        transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : 'hover:bg-gray-750'}
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
      `}
      onClick={() => onSelect?.(task.id)}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 w-4 h-8 cursor-grab active:cursor-grabbing flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </div>

      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-400">{priorityLabels[task.priority]}</span>
        <div className="flex items-center gap-2">
          {/* 执行状态徽章 */}
          {task.execution?.status && executionStatusConfig[task.execution.status] && (
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${executionStatusConfig[task.execution.status].className}`}>
              {executionStatusConfig[task.execution.status].label}
            </span>
          )}
          {task.estimateHours && (
            <span className="text-xs text-gray-500">{task.estimateHours}h</span>
          )}
        </div>
      </div>
      <h4 className="font-medium text-white mb-2">{task.title}</h4>
      <p className="text-sm text-gray-400 mb-2 line-clamp-2">{task.description}</p>

      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map((label, i) => (
            <span key={i} className="px-2 py-0.5 text-xs bg-blue-900/50 text-blue-300 rounded">
              {label}
            </span>
          ))}
        </div>
      )}

      {task.acceptanceCriteria.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Acceptance Criteria:</p>
          <ul className="text-xs text-gray-400 space-y-0.5">
            {task.acceptanceCriteria.slice(0, 3).map((ac, i) => (
              <li key={i} className="flex items-start">
                <span className="mr-1 text-gray-600">-</span>
                <span className="line-clamp-1">{ac}</span>
              </li>
            ))}
            {task.acceptanceCriteria.length > 3 && (
              <li className="text-gray-500">+{task.acceptanceCriteria.length - 3} more...</li>
            )}
          </ul>
        </div>
      )}

      {task.blockedBy && task.blockedBy.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <span className="text-xs text-purple-400">
            Blocked by {task.blockedBy.length} task{task.blockedBy.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* PR 链接（已完成的任务） */}
      {task.execution?.status === 'COMPLETED' && task.execution.prUrl && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <a
            href={task.execution.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
              <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
            </svg>
            PR #{task.execution.prNumber || 'View'}
          </a>
        </div>
      )}

      {/* 错误信息（失败的任务） */}
      {task.execution?.status === 'FAILED' && task.execution.error && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <span className="text-xs text-red-400 line-clamp-2">
            {task.execution.error}
          </span>
        </div>
      )}
    </div>
  )
}
