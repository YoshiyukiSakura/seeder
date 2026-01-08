'use client'

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Handle, Position, type Node } from '@xyflow/react'
import { Task } from '../types'

export interface TaskNodeData extends Record<string, unknown> {
  task: Task
  onUpdate: (taskId: string, updates: Partial<Task>) => void
  onDelete: (taskId: string) => void
  onSelect: (taskId: string) => void
}

export type TaskNodeType = Node<TaskNodeData, 'taskNode'>

interface TaskNodeProps {
  data: TaskNodeData
  selected?: boolean
}

const priorityColors: Record<number, string> = {
  0: 'border-red-500 bg-red-900/20',
  1: 'border-orange-500 bg-orange-900/20',
  2: 'border-yellow-500 bg-yellow-900/20',
  3: 'border-gray-500 bg-gray-900/20',
}

const priorityLabels = ['P0', 'P1', 'P2', 'P3']

function TaskNodeComponent({ data, selected }: TaskNodeProps) {
  const { task, onUpdate, onSelect } = data
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

  // 双击进入编辑模式
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
    setEditTitle(task.title)
  }, [task.title])

  // 保存编辑
  const handleSave = useCallback(() => {
    if (editTitle.trim() && editTitle !== task.title) {
      onUpdate(task.id, { title: editTitle.trim() })
    }
    setIsEditing(false)
  }, [editTitle, task.id, task.title, onUpdate])

  // 取消编辑
  const handleCancel = useCallback(() => {
    setEditTitle(task.title)
    setIsEditing(false)
  }, [task.title])

  // 键盘处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }, [handleSave, handleCancel])

  // 点击选择任务
  const handleClick = useCallback(() => {
    onSelect(task.id)
  }, [task.id, onSelect])

  // 编辑模式时聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  return (
    <div
      className={`
        w-[280px] border-l-4 ${priorityColors[task.priority] || priorityColors[2]}
        rounded-lg p-3 bg-gray-800 cursor-pointer
        transition-all duration-200
        ${selected ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : 'hover:bg-gray-750'}
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* 左侧连接点 - 被依赖 (target) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-purple-300"
      />

      {/* 右侧连接点 - 依赖其他 (source) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-indigo-300"
      />

      {/* 优先级和工时 */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-400">
          {priorityLabels[task.priority]}
        </span>
        {task.estimateHours && (
          <span className="text-xs text-gray-500">{task.estimateHours}h</span>
        )}
      </div>

      {/* 标题 - 支持双击编辑 */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full font-medium text-white bg-gray-700 border border-blue-500 rounded px-2 py-1 outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <h4 className="font-medium text-white mb-2 line-clamp-2">{task.title}</h4>
      )}

      {/* 描述 */}
      {!isEditing && (
        <p className="text-sm text-gray-400 mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* 标签 */}
      {task.labels.length > 0 && !isEditing && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 2).map((label, i) => (
            <span key={i} className="px-2 py-0.5 text-xs bg-blue-900/50 text-blue-300 rounded">
              {label}
            </span>
          ))}
          {task.labels.length > 2 && (
            <span className="text-xs text-gray-500">+{task.labels.length - 2}</span>
          )}
        </div>
      )}

      {/* 依赖提示 */}
      {task.blockedBy && task.blockedBy.length > 0 && !isEditing && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <span className="text-xs text-purple-400">
            Blocked by {task.blockedBy.length} task{task.blockedBy.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
}

export const TaskNode = memo(TaskNodeComponent)
