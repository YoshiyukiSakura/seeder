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
  extracting?: boolean
  canExtract?: boolean
  onExtract?: () => void
}

type PriorityFilter = 'all' | 0 | 1 | 2 | 3

export function TaskList({ tasks, onTasksReorder, onTaskUpdate, onTaskDelete, planId, planName, loading = false, extracting = false, canExtract = false, onExtract }: TaskListProps) {
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

        {/* Publish to Linear button */}
        {tasks.length > 0 && (
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={() => setShowPublishDialog(true)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Publish to Linear
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
