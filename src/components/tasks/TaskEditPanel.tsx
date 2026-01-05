'use client'

import { useState, useEffect } from 'react'
import { Task, TaskUpdateHandler, TaskDeleteHandler } from './types'

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

export function TaskEditPanel({ task, allTasks, onUpdate, onDelete, onClose }: TaskEditPanelProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(2)
  const [labels, setLabels] = useState<string[]>([])
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>([])
  const [estimateHours, setEstimateHours] = useState<string>('')
  const [dependsOnId, setDependsOnId] = useState<string | null>(null)
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
      setDependsOnId(task.dependsOnId || null)
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
      dependsOnId,
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

  // Get available tasks for dependency (exclude self and dependents)
  const availableForDependency = allTasks.filter(t => {
    if (t.id === task.id) return false
    // Prevent circular dependencies
    if (t.dependsOnId === task.id) return false
    return true
  })

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

        {/* Dependencies */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Depends On</label>
          <select
            value={dependsOnId || ''}
            onChange={(e) => setDependsOnId(e.target.value || null)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No dependency</option>
            {availableForDependency.map(t => (
              <option key={t.id} value={t.id}>
                [{['P0', 'P1', 'P2', 'P3'][t.priority]}] {t.title}
              </option>
            ))}
          </select>
          {dependsOnId && (
            <p className="mt-2 text-xs text-purple-400">
              This task will be blocked until the dependent task is completed.
            </p>
          )}
        </div>
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
