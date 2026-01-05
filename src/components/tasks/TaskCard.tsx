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
        {task.estimateHours && (
          <span className="text-xs text-gray-500">{task.estimateHours}h</span>
        )}
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

      {task.dependsOnId && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <span className="text-xs text-purple-400">Depends on task</span>
        </div>
      )}
    </div>
  )
}
