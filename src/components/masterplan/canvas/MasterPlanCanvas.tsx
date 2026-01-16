'use client'

import { useCallback, useState, useEffect } from 'react'
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

import { MasterPlan, PlanSummary } from '../types'
import { PlanNode, PlanNodeData } from './PlanNode'
import { PlanEdge } from './PlanEdge'
import { usePlanNodes } from './hooks/usePlanNodes'
import { usePlanEdges } from './hooks/usePlanEdges'

// 自定义节点类型 - 使用类型断言绕过严格的类型检查
const nodeTypes = {
  planNode: PlanNode,
} as const

// 自定义边类型
const edgeTypes = {
  planEdge: PlanEdge,
} as const

interface MasterPlanCanvasProps {
  masterPlan: MasterPlan
  onPlanSelect?: (planId: string) => void
  onPlansChange?: (plans: PlanSummary[]) => void
  onDependencyAdd?: (targetPlanId: string, sourcePlanId: string) => void
  onDependencyRemove?: (targetPlanId: string, sourcePlanId: string) => void
  selectedPlanId?: string | null
}

export function MasterPlanCanvas({
  masterPlan,
  onPlanSelect,
  onPlansChange,
  onDependencyAdd,
  onDependencyRemove,
  selectedPlanId,
}: MasterPlanCanvasProps) {
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null)

  const effectiveSelectedId = selectedPlanId ?? localSelectedId

  const handlePlanSelect = useCallback(
    (planId: string) => {
      setLocalSelectedId(planId)
      onPlanSelect?.(planId)
    },
    [onPlanSelect]
  )

  const initialNodes = usePlanNodes(masterPlan.plans, handlePlanSelect, effectiveSelectedId)
  const initialEdges = usePlanEdges(masterPlan.plans)

  const [nodes, setNodes] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // 当 plans 变化时，更新节点数据（但保留位置）
  useEffect(() => {
    setNodes((currentNodes) => {
      const positionMap = new Map(
        currentNodes.map((node) => [node.id, node.position])
      )

      return masterPlan.plans.map((plan, index) => {
        const existingPosition = positionMap.get(plan.id)
        const position = existingPosition || {
          x: (index % 3) * 400,
          y: Math.floor(index / 3) * 200,
        }

        return {
          id: plan.id,
          type: 'planNode',
          position,
          data: {
            plan,
            onSelect: handlePlanSelect,
            isSelected: effectiveSelectedId === plan.id,
          },
          draggable: true,
          selectable: true,
        }
      })
    })
  }, [masterPlan.plans, handlePlanSelect, effectiveSelectedId, setNodes])

  // 当 plans 的依赖关系变化时，更新边
  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  // 处理节点变化（包括位置变化）
  const onNodesChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (changes: NodeChange<any>[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setNodes((nds: any) => applyNodeChanges(changes, nds))
    },
    [setNodes]
  )

  // 处理连接 - 创建依赖关系
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      // 添加边
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'planEdge',
            animated: false,
            style: { stroke: '#8b5cf6', strokeWidth: 3 },
          },
          eds
        )
      )

      // 通知父组件添加依赖
      onDependencyAdd?.(connection.target, connection.source)
    },
    [setEdges, onDependencyAdd]
  )

  // 处理边删除
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: { source: string; target: string }) => {
      if (onDependencyRemove) {
        setEdges((eds) => eds.filter((e) => !(e.source === edge.source && e.target === edge.target)))
        onDependencyRemove(edge.target, edge.source)
      }
    },
    [setEdges, onDependencyRemove]
  )

  return (
    <div className="w-full h-full bg-gray-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'planEdge',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
        <Controls className="!bg-gray-800 !border-gray-700" />
        <MiniMap
          className="!bg-gray-800 !border-gray-700"
          nodeColor={(node) => {
            const data = node.data as unknown as PlanNodeData
            if (data?.isSelected) return '#3b82f6'
            switch (data?.plan?.status) {
              case 'PUBLISHED':
                return '#22c55e'
              case 'REVIEWING':
                return '#eab308'
              case 'ARCHIVED':
                return '#8b5cf6'
              default:
                return '#6b7280'
            }
          }}
        />
      </ReactFlow>
    </div>
  )
}
