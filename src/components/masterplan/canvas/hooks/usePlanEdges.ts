'use client'

import { useMemo } from 'react'
import { Edge, MarkerType } from '@xyflow/react'
import { PlanSummary } from '../../types'

export function usePlanEdges(plans: PlanSummary[]): Edge[] {
  return useMemo(() => {
    const edges: Edge[] = []

    plans.forEach((plan) => {
      plan.blockedByPlanIds.forEach((blockedById) => {
        // blockedById -> plan (source blocks target)
        edges.push({
          id: `${blockedById}-${plan.id}`,
          source: blockedById,
          target: plan.id,
          type: 'planEdge',
          animated: false,
          style: { stroke: '#8b5cf6', strokeWidth: 3 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#8b5cf6',
          },
        })
      })
    })

    return edges
  }, [plans])
}
