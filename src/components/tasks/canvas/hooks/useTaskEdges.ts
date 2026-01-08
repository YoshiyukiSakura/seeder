import { useMemo } from 'react'
import { Edge, MarkerType } from '@xyflow/react'
import { Task } from '../../types'

export function useTaskEdges(tasks: Task[]): Edge[] {
  return useMemo(() => {
    const edges: Edge[] = []

    tasks.forEach((task) => {
      // 从 blockedBy 数组生成边
      if (task.blockedBy && task.blockedBy.length > 0) {
        task.blockedBy.forEach((blockerId) => {
          // 确保 blocker 任务存在
          const blockerExists = tasks.some((t) => t.id === blockerId)
          if (blockerExists) {
            edges.push({
              id: `${blockerId}->${task.id}`,
              source: blockerId,
              target: task.id,
              type: 'dependencyEdge',
              animated: false,
              style: {
                stroke: '#6366f1',
                strokeWidth: 2,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#6366f1',
              },
            })
          }
        })
      }
    })

    return edges
  }, [tasks])
}
