'use client'

import { useCallback, useState, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  NodeChange,
  applyNodeChanges,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { Task, TaskUpdateHandler, TaskDeleteHandler } from '../types'
import { TaskNode, TaskNodeData } from './TaskNode'
import { DependencyEdge } from './DependencyEdge'
import { useTaskNodes } from './hooks/useTaskNodes'
import { useTaskEdges } from './hooks/useTaskEdges'
import { useAutoLayout } from './hooks/useAutoLayout'
import { TaskEditPanel } from '../TaskEditPanel'

// 自定义节点类型 - 使用类型断言绕过严格的类型检查
const nodeTypes = {
  taskNode: TaskNode,
} as const

// 自定义边类型
const edgeTypes = {
  dependencyEdge: DependencyEdge,
} as const

interface TaskCanvasProps {
  tasks: Task[]
  onTasksChange: (tasks: Task[]) => void
  onTaskUpdate: TaskUpdateHandler
  onTaskDelete: TaskDeleteHandler
  planId?: string
}

export function TaskCanvas({
  tasks,
  onTasksChange,
  onTaskUpdate,
  onTaskDelete,
  planId,
}: TaskCanvasProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const { getLayoutedElements } = useAutoLayout()

  // 生成初始节点和边
  const initialNodes = useTaskNodes(tasks, onTaskUpdate, onTaskDelete, setSelectedTaskId)
  const initialEdges = useTaskEdges(tasks)

  // 节点和边的状态
  const [nodes, setNodes] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // 当 tasks 变化时，更新节点数据（但保留位置）
  useEffect(() => {
    setNodes((currentNodes) => {
      // 创建当前节点的位置映射
      const positionMap = new Map(
        currentNodes.map((node) => [node.id, node.position])
      )

      // 更新节点，保留已有位置
      return tasks.map((task, index) => {
        const existingPosition = positionMap.get(task.id)
        const position = existingPosition || task.position || {
          x: (index % 4) * 320,
          y: Math.floor(index / 4) * 190,
        }

        return {
          id: task.id,
          type: 'taskNode',
          position,
          data: {
            task,
            onUpdate: onTaskUpdate,
            onDelete: onTaskDelete,
            onSelect: setSelectedTaskId,
          },
          draggable: true,
          selectable: true,
        }
      })
    })
  }, [tasks, onTaskUpdate, onTaskDelete, setNodes])

  // 当 tasks 的依赖关系变化时，更新边
  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  // 处理节点变化（包括位置变化）
  const onNodesChange = useCallback(
    (changes: NodeChange<Node<TaskNodeData>>[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds))
    },
    [setNodes]
  )

  // 处理节点拖拽结束 - 保存位置
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // 更新任务的位置
      const updatedTasks = tasks.map((task) => {
        if (task.id === node.id) {
          return {
            ...task,
            position: {
              x: node.position.x,
              y: node.position.y,
            },
          }
        }
        return task
      })
      onTasksChange(updatedTasks)
    },
    [tasks, onTasksChange]
  )

  // 处理连接 - 创建依赖关系
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      // 添加边
      setEdges((eds) => addEdge({
        ...connection,
        type: 'dependencyEdge',
        animated: false,
        style: { stroke: '#6366f1', strokeWidth: 2 },
      }, eds))

      // 更新目标任务的 blockedBy
      const updatedTasks = tasks.map((task) => {
        if (task.id === connection.target) {
          const currentBlockedBy = task.blockedBy || []
          if (!currentBlockedBy.includes(connection.source!)) {
            return {
              ...task,
              blockedBy: [...currentBlockedBy, connection.source!],
            }
          }
        }
        return task
      })
      onTasksChange(updatedTasks)
    },
    [tasks, onTasksChange, setEdges]
  )

  // 处理边删除 - 移除依赖关系
  const onEdgeDelete = useCallback(
    (edgesToDelete: { source: string; target: string }[]) => {
      const updatedTasks = tasks.map((task) => {
        const edgeToThisTask = edgesToDelete.find((e) => e.target === task.id)
        if (edgeToThisTask && task.blockedBy) {
          return {
            ...task,
            blockedBy: task.blockedBy.filter((id) => id !== edgeToThisTask.source),
          }
        }
        return task
      })
      onTasksChange(updatedTasks)
    },
    [tasks, onTasksChange]
  )

  // 自动布局
  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges
    )
    setNodes(layoutedNodes as Node<TaskNodeData>[])
    setEdges([...layoutedEdges])

    // 保存新位置
    const updatedTasks = tasks.map((task) => {
      const node = layoutedNodes.find((n) => n.id === task.id)
      if (node) {
        return {
          ...task,
          position: { x: node.position.x, y: node.position.y },
        }
      }
      return task
    })
    onTasksChange(updatedTasks)
  }, [nodes, edges, getLayoutedElements, setNodes, setEdges, tasks, onTasksChange])

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  )

  return (
    <div className="flex w-full h-full">
      <div className="flex-1 relative" style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'dependencyEdge',
          }}
          connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
          <Controls className="!bg-gray-800 !border-gray-700 !rounded-lg" />
          <MiniMap
            nodeColor={(node) => {
              const task = (node.data as TaskNodeData)?.task
              if (!task) return '#6b7280'
              const colors: Record<number, string> = {
                0: '#ef4444',
                1: '#f97316',
                2: '#eab308',
                3: '#6b7280',
              }
              return colors[task.priority] || '#6b7280'
            }}
            className="!bg-gray-900 !border-gray-700 !rounded-lg"
            maskColor="rgba(0, 0, 0, 0.8)"
          />
        </ReactFlow>

        {/* 工具栏 */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={handleAutoLayout}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm text-white flex items-center gap-2 transition-colors"
            title="Auto Layout"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            Auto Layout
          </button>
        </div>

        {/* 任务统计 */}
        <div className="absolute bottom-4 left-4 px-3 py-2 bg-gray-800/90 border border-gray-700 rounded-lg text-sm text-gray-300">
          {tasks.length} tasks | {edges.length} dependencies
        </div>
      </div>

      {/* 编辑面板 */}
      {selectedTaskId && (
        <TaskEditPanel
          task={selectedTask}
          allTasks={tasks}
          onUpdate={onTaskUpdate}
          onDelete={onTaskDelete}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  )
}
