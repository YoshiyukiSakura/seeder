'use client'

import { useState, useEffect, useMemo } from 'react'
import { Task, TaskUpdateHandler, TaskDeleteHandler } from './types'
import { detectCycle } from '@/lib/dependency-utils'

interface TaskEditPanelProps {
  task: Task | null
  allTasks: Task[]
  onUpdate: TaskUpdateHandler
  onDelete: TaskDeleteHandler
  onClose: () => void
}

const priorityOptions = [
  { value: 0, label: 'P0 - Urgent', color: 'text-red-400' },
  { value: 1, label: 'P1 - High', color: 'text-orange-400' },
  { value: 2, label: 'P2 - Medium', color: 'text-yellow-400' },
  { value: 3, label: 'P3 - Low', color: 'text-gray-400' },
]

const labelOptions = ['backend', 'frontend', 'test', 'database', 'API', 'UI']

// 执行状态配置
const executionStatusConfig: Record<string, { label: string; className: string }> = {
  PENDING: { label: '待执行', className: 'bg-gray-600 text-gray-200' },
  WAITING_DEPS: { label: '等待依赖', className: 'bg-purple-600 text-purple-100' },
  RUNNING: { label: '执行中', className: 'bg-blue-600 text-blue-100' },
  COMPLETED: { label: '已完成', className: 'bg-green-600 text-green-100' },
  FAILED: { label: '失败', className: 'bg-red-600 text-red-100' },
  SKIPPED: { label: '跳过', className: 'bg-yellow-600 text-yellow-100' },
}

// Git 操作状态步骤
const gitStatusSteps = [
  { key: 'NOT_STARTED', label: '未开始' },
  { key: 'BRANCH_CREATED', label: '分支已创建' },
  { key: 'COMMITTED', label: '代码已提交' },
  { key: 'PUSHED', label: '已推送' },
  { key: 'PR_CREATED', label: 'PR 已创建' },
]

export function TaskEditPanel({ task, allTasks, onUpdate, onDelete, onClose }: TaskEditPanelProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(2)
  const [labels, setLabels] = useState<string[]>([])
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>([])
  const [estimateHours, setEstimateHours] = useState<string>('')
  const [blockedBy, setBlockedBy] = useState<string[]>([])
  const [newCriterion, setNewCriterion] = useState('')

  // Sync state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description)
      setPriority(task.priority)
      setLabels(task.labels)
      setAcceptanceCriteria(task.acceptanceCriteria)
      setEstimateHours(task.estimateHours?.toString() || '')
      setBlockedBy(task.blockedBy || [])
    }
  }, [task])

  if (!task) return null

  const handleSave = () => {
    onUpdate(task.id, {
      title,
      description,
      priority,
      labels,
      acceptanceCriteria,
      estimateHours: estimateHours ? parseFloat(estimateHours) : undefined,
      blockedBy,
    })
  }

  const handleAddCriterion = () => {
    if (newCriterion.trim()) {
      setAcceptanceCriteria([...acceptanceCriteria, newCriterion.trim()])
      setNewCriterion('')
    }
  }

  const handleRemoveCriterion = (index: number) => {
    setAcceptanceCriteria(acceptanceCriteria.filter((_, i) => i !== index))
  }

  const handleUpdateCriterion = (index: number, value: string) => {
    const updated = [...acceptanceCriteria]
    updated[index] = value
    setAcceptanceCriteria(updated)
  }

  const toggleLabel = (label: string) => {
    if (labels.includes(label)) {
      setLabels(labels.filter(l => l !== label))
    } else {
      setLabels([...labels, label])
    }
  }

  // Get available tasks for dependency (exclude self and tasks that depend on current task)
  const availableForDependency = allTasks.filter(t => {
    if (t.id === task.id) return false
    // Prevent direct circular dependencies - if task t is blocked by current task, we can't depend on t
    if (t.blockedBy?.includes(task.id)) return false
    return true
  })

  // Check if adding a blocker would create a cycle
  const wouldCreateCycle = useMemo(() => {
    const result = new Set<string>()
    for (const t of availableForDependency) {
      if (!blockedBy.includes(t.id)) {
        const newBlockedBy = [...blockedBy, t.id]
        if (detectCycle(task.id, newBlockedBy, allTasks)) {
          result.add(t.id)
        }
      }
    }
    return result
  }, [task.id, blockedBy, allTasks, availableForDependency])

  // Toggle a blocker task
  const toggleBlocker = (taskId: string) => {
    if (blockedBy.includes(taskId)) {
      setBlockedBy(blockedBy.filter(id => id !== taskId))
    } else {
      // Check for circular dependency before adding
      const newBlockedBy = [...blockedBy, taskId]
      if (detectCycle(task.id, newBlockedBy, allTasks)) {
        alert('Cannot add this dependency: it would create a circular dependency.')
        return
      }
      setBlockedBy(newBlockedBy)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-gray-900 border-l border-gray-700 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Edit Task</h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
          <div className="grid grid-cols-2 gap-2">
            {priorityOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPriority(opt.value)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  priority === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <span className={priority === opt.value ? 'text-white' : opt.color}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Labels */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Labels</label>
          <div className="flex flex-wrap gap-2">
            {labelOptions.map(label => (
              <button
                key={label}
                onClick={() => toggleLabel(label)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  labels.includes(label)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Estimate */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Estimate (hours)</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={estimateHours}
            onChange={(e) => setEstimateHours(e.target.value)}
            placeholder="e.g., 2.5"
            className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Acceptance Criteria */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Acceptance Criteria ({acceptanceCriteria.length})
          </label>
          <div className="space-y-2">
            {acceptanceCriteria.map((ac, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={ac}
                  onChange={(e) => handleUpdateCriterion(index, e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleRemoveCriterion(index)}
                  className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Add new criterion */}
            <div className="flex items-center gap-2 mt-3">
              <input
                type="text"
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCriterion()}
                placeholder="Add new criterion..."
                className="flex-1 bg-gray-800 border border-gray-600 border-dashed rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddCriterion}
                disabled={!newCriterion.trim()}
                className="p-2 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Dependencies - Blocked By */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Blocked By ({blockedBy.length} task{blockedBy.length !== 1 ? 's' : ''})
          </label>
          <div className="max-h-48 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg p-2 space-y-1">
            {availableForDependency.length === 0 ? (
              <p className="text-sm text-gray-500 p-2">No other tasks available</p>
            ) : (
              <>
                {/* Selected tasks first */}
                {availableForDependency
                  .filter(t => blockedBy.includes(t.id))
                  .map(t => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleBlocker(t.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
                      />
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        t.priority === 0 ? 'bg-red-900/50 text-red-400' :
                        t.priority === 1 ? 'bg-orange-900/50 text-orange-400' :
                        t.priority === 2 ? 'bg-yellow-900/50 text-yellow-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        P{t.priority}
                      </span>
                      <span className="text-sm text-white truncate">{t.title}</span>
                    </label>
                  ))}
                {/* Unselected tasks */}
                {availableForDependency
                  .filter(t => !blockedBy.includes(t.id))
                  .map(t => {
                    const isCyclic = wouldCreateCycle.has(t.id)
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          isCyclic
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-gray-700 cursor-pointer'
                        }`}
                        title={isCyclic ? 'Adding this would create a circular dependency' : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => !isCyclic && toggleBlocker(t.id)}
                          disabled={isCyclic}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500 disabled:opacity-50"
                        />
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          t.priority === 0 ? 'bg-red-900/50 text-red-400' :
                          t.priority === 1 ? 'bg-orange-900/50 text-orange-400' :
                          t.priority === 2 ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          P{t.priority}
                        </span>
                        <span className="text-sm text-gray-300 truncate flex-1">{t.title}</span>
                        {isCyclic && (
                          <span className="text-xs text-orange-400" title="Circular dependency">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </span>
                        )}
                      </label>
                    )
                  })}
              </>
            )}
          </div>
          {blockedBy.length > 0 && (
            <p className="mt-2 text-xs text-purple-400">
              This task is blocked until the selected task(s) are completed.
            </p>
          )}
        </div>

        {/* 执行状态 */}
        {task.execution && (
          <div className="pt-4 border-t border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-3">执行状态</label>

            {/* 状态徽章 */}
            <div className="flex items-center gap-3 mb-4">
              {task.execution.status && executionStatusConfig[task.execution.status] && (
                <span className={`px-3 py-1 text-sm rounded-full font-medium ${executionStatusConfig[task.execution.status].className}`}>
                  {executionStatusConfig[task.execution.status].label}
                </span>
              )}

              {/* 时间信息 */}
              <div className="text-xs text-gray-500">
                {task.execution.startedAt && (
                  <span>开始: {new Date(task.execution.startedAt).toLocaleString('zh-CN')}</span>
                )}
                {task.execution.completedAt && (
                  <span className="ml-3">完成: {new Date(task.execution.completedAt).toLocaleString('zh-CN')}</span>
                )}
              </div>
            </div>

            {/* Git 操作进度 */}
            {task.execution.gitStatus && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Git 操作进度</p>
                <div className="flex items-center gap-1">
                  {gitStatusSteps.map((step, index) => {
                    const currentIndex = gitStatusSteps.findIndex(s => s.key === task.execution?.gitStatus)
                    const isCompleted = index <= currentIndex
                    const isCurrent = index === currentIndex
                    return (
                      <div key={step.key} className="flex items-center">
                        <div className={`
                          w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                          ${isCompleted ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-500'}
                          ${isCurrent && task.execution?.status === 'RUNNING' ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''}
                        `}>
                          {isCompleted ? '✓' : index + 1}
                        </div>
                        {index < gitStatusSteps.length - 1 && (
                          <div className={`w-4 h-0.5 ${index < currentIndex ? 'bg-green-600' : 'bg-gray-700'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
                  {gitStatusSteps.map(step => (
                    <span key={step.key} className="w-6 text-center" style={{ fontSize: '9px' }}>
                      {step.label.slice(0, 2)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* PR 链接 */}
            {task.execution.prUrl && (
              <div className="mb-4">
                <a
                  href={task.execution.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
                  </svg>
                  <span className="text-sm">Pull Request #{task.execution.prNumber || ''}</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}

            {/* 错误信息 */}
            {task.execution.status === 'FAILED' && task.execution.error && (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                <p className="text-xs text-red-400 font-medium mb-1">错误信息</p>
                <p className="text-sm text-red-300 whitespace-pre-wrap">{task.execution.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 flex items-center justify-between">
        <button
          onClick={() => {
            if (confirm('Are you sure you want to delete this task?')) {
              onDelete(task.id)
              onClose()
            }
          }}
          className="px-4 py-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
        >
          Delete Task
        </button>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
