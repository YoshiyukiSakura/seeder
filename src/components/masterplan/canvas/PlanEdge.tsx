'use client'

import { memo } from 'react'
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react'

function PlanEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: '#8b5cf6',
        strokeWidth: 3,
        ...style,
      }}
    />
  )
}

export const PlanEdge = memo(PlanEdgeComponent)
