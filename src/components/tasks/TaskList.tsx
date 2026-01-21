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
import { TaskListSkeleton } from '../ui/Skeleton'
import { ExportDialog } from '../export'

interface TaskListProps {
  tasks: Task[]
  onTasksReorder: (tasks: Task[]) => void
  onTaskUpdate: TaskUpdateHandler
  onTaskDelete: TaskDeleteHandler
  loading?: boolean
  extracting?: boolean
  canExtract?: boolean
  onExtract?: () => void
  planId?: string | null
  planStatus?: string
  onPublish?: () => void
  projectId?: string | null
  onSaveAsPlan?: (name: string) => Promise<void>
  planName?: string
  planDescription?: string
}

type PriorityFilter = 'all' | 0 | 1 | 2 | 3

export function TaskList({ tasks, onTasksReorder, onTaskUpdate, onTaskDelete, loading = false, extracting = false, canExtract = false, onExtract, planId, planStatus, onPublish, planName, planDescription }: TaskListProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showReExtractConfirm, setShowReExtractConfirm] = useState(false)

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
          {/* Publish Button */}
          {planId && tasks.length > 0 && planStatus !== 'PUBLISHED' && onPublish && (
            <button
              onClick={onPublish}
              className="mt-3 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Publish Plan
            </button>
          )}
          {planStatus === 'PUBLISHED' && (
            <div className="mt-3 px-3 py-2 bg-green-900/30 border border-green-700 text-green-400 rounded-lg text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Published
            </div>
          )}
          {/* Export Button */}
          {tasks.length > 0 && (
            <button
              onClick={() => setShowExportDialog(true)}
              className="mt-3 w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Export Plan
            </button>
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
          ) : extracting ? (
            <div className="space-y-4">
              {/* Progress indicator */}
              <div className="bg-gray-800 rounded-lg p-4 border border-blue-500/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                  <span className="text-blue-400 font-medium">Extracting tasks...</span>
                </div>
                <p className="text-xs text-gray-500">Gemini 3 Pro is analyzing your plan</p>
              </div>
              <TaskListSkeleton count={3} />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              <p className="text-sm">No tasks yet</p>
              <p className="text-xs mt-1">Tasks will appear here after planning</p>
              {canExtract && onExtract && (
                <button
                  onClick={onExtract}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Extract Tasks
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Re-extract button (shown when tasks exist and canExtract) */}
              {canExtract && onExtract && (
                <button
                  onClick={() => setShowReExtractConfirm(true)}
                  className="mb-3 w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Re-extract Tasks
                </button>
              )}

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

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        tasks={tasks}
        planName={planName}
        planDescription={planDescription}
      />

      {/* Re-extract Confirmation Dialog */}
      {showReExtractConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-900/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Re-extract Tasks</h3>
                  <p className="text-sm text-gray-400">This will replace existing tasks</p>
                </div>
              </div>

              <p className="text-gray-300 mb-2">
                Are you sure you want to re-extract tasks from the conversation?
              </p>
              <p className="text-sm text-gray-400 mb-6">
                All current tasks will be replaced with newly extracted ones. Any manual edits you made will be lost.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowReExtractConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReExtractConfirm(false)
                    onExtract?.()
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Re-extract
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
