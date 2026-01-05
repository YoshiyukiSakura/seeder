'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Task, TaskUpdateHandler, TaskDeleteHandler } from './types'
import { TaskCard } from './TaskCard'
import { TaskEditPanel } from './TaskEditPanel'
import { PublishDialog } from '../publish/PublishDialog'
import { TaskListSkeleton } from '../ui/Skeleton'

interface TaskListProps {
  tasks: Task[]
  onTasksReorder: (tasks: Task[]) => void
  onTaskUpdate: TaskUpdateHandler
  onTaskDelete: TaskDeleteHandler
  planId?: string
  planName?: string
  loading?: boolean
}

type PriorityFilter = 'all' | 0 | 1 | 2 | 3

export function TaskList({ tasks, onTasksReorder, onTaskUpdate, onTaskDelete, planId, planName, loading = false }: TaskListProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [showPublishDialog, setShowPublishDialog] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex(t => t.id === active.id)
      const newIndex = tasks.findIndex(t => t.id === over.id)

      const newTasks = [...tasks]
      const [removed] = newTasks.splice(oldIndex, 1)
      newTasks.splice(newIndex, 0, removed)

      // Update sortOrder for all tasks
      const reorderedTasks = newTasks.map((task, index) => ({
        ...task,
        sortOrder: index,
      }))

      onTasksReorder(reorderedTasks)
    }
  }

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null

  const filteredTasks = priorityFilter === 'all'
    ? tasks
    : tasks.filter(t => t.priority === priorityFilter)

  const totalEstimate = tasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0)

  const handleClosePanel = () => {
    setSelectedTaskId(null)
  }

  const handleExportJSON = () => {
    const json = JSON.stringify(tasks, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tasks.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportMarkdown = () => {
    const md = tasks.map(t =>
      `### [P${t.priority}] ${t.title}\n\n${t.description}\n\n` +
      (t.acceptanceCriteria.length ? `**Acceptance Criteria:**\n${t.acceptanceCriteria.map(ac => `- ${ac}`).join('\n')}\n\n` : '') +
      (t.estimateHours ? `**Estimate:** ${t.estimateHours}h\n` : '') +
      (t.dependsOnId ? `**Depends on:** ${tasks.find(x => x.id === t.dependsOnId)?.title || t.dependsOnId}\n` : '')
    ).join('\n---\n\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tasks.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="w-96 flex flex-col bg-gray-850">
        {/* Header */}
        <header className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Tasks</h2>
            {tasks.length > 0 && (
              <span className="text-sm text-gray-400">{tasks.length} tasks</span>
            )}
          </div>
          {tasks.length > 0 && totalEstimate > 0 && (
            <p className="text-xs text-gray-500 mt-1">Est. {totalEstimate}h total</p>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && tasks.length === 0 ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 mb-3">
                Generating tasks...
              </p>
              <TaskListSkeleton count={3} />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              <p className="text-sm">No tasks yet</p>
              <p className="text-xs mt-1">Tasks will appear here after planning</p>
            </div>
          ) : (
            <>
              {/* Priority filters */}
              <div className="flex gap-2 mb-4">
                {(['all', 0, 1, 2] as const).map(filter => {
                  const label = filter === 'all' ? 'All' : `P${filter}`
                  const count = filter === 'all' ? tasks.length : tasks.filter(t => t.priority === filter).length
                  return (
                    <button
                      key={filter}
                      onClick={() => setPriorityFilter(filter)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        priorityFilter === filter
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  )
                })}
              </div>

              {/* Drag hint */}
              <p className="text-xs text-gray-500 mb-3">
                Click to edit. Drag to reorder.
              </p>

              {/* Task cards with drag and drop */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredTasks.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isSelected={task.id === selectedTaskId}
                      onSelect={setSelectedTaskId}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>

        {/* Export & Publish buttons */}
        {tasks.length > 0 && (
          <div className="p-4 border-t border-gray-700 space-y-2">
            {/* Publish to Linear button */}
            {planId && (
              <button
                onClick={() => setShowPublishDialog(true)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Publish to Linear
              </button>
            )}
            <button
              onClick={handleExportJSON}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={handleExportMarkdown}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              Export Markdown
            </button>
          </div>
        )}
      </div>

      {/* Edit Panel */}
      {selectedTaskId && (
        <TaskEditPanel
          task={selectedTask}
          allTasks={tasks}
          onUpdate={(taskId, updates) => {
            onTaskUpdate(taskId, updates)
          }}
          onDelete={onTaskDelete}
          onClose={handleClosePanel}
        />
      )}

      {/* Publish Dialog */}
      {planId && (
        <PublishDialog
          isOpen={showPublishDialog}
          onClose={() => setShowPublishDialog(false)}
          tasks={tasks}
          planId={planId}
          planName={planName || 'Untitled Plan'}
        />
      )}
    </>
  )
}
