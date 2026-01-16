'use client'

import { useMemo } from 'react'
import { PlanSummary } from '../../types'
import { PlanNodeType } from '../PlanNode'

export function usePlanNodes(
  plans: PlanSummary[],
  onSelect?: (planId: string) => void,
  selectedPlanId?: string | null
): PlanNodeType[] {
  return useMemo(() => {
    return plans.map((plan, index) => {
      // 使用 sortOrder 来确定位置，如果没有则按索引
      const col = index % 3
      const row = Math.floor(index / 3)

      return {
        id: plan.id,
        type: 'planNode',
        position: {
          x: col * 400,
          y: row * 200,
        },
        data: {
          plan,
          onSelect,
          isSelected: selectedPlanId === plan.id,
        },
        draggable: true,
        selectable: true,
      }
    })
  }, [plans, onSelect, selectedPlanId])
}
