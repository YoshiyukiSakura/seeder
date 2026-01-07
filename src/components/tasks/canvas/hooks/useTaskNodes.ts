import { useMemo } from 'react'
import { Node } from '@xyflow/react'
import { Task } from '../../types'
import type { TaskNodeData } from '../TaskNode'

const DEFAULT_NODE_WIDTH = 280
const DEFAULT_NODE_HEIGHT = 150

export function useTaskNodes(
  tasks: Task[],
  onUpdate: (taskId: string, updates: Partial<Task>) => void,
  onDelete: (taskId: string) => void,
  onSelect: (taskId: string) => void
): Node<TaskNodeData>[] {
  return useMemo(() => {
    return tasks.map((task, index) => {
      // 如果任务有保存的位置，使用它；否则使用网格布局
      const position = task.position || {
        x: (index % 4) * (DEFAULT_NODE_WIDTH + 40),
        y: Math.floor(index / 4) * (DEFAULT_NODE_HEIGHT + 40),
      }

      return {
        id: task.id,
        type: 'taskNode',
        position,
        data: {
          task,
          onUpdate,
          onDelete,
          onSelect,
        },
        // 允许拖拽
        draggable: true,
        // 允许选择
        selectable: true,
      }
    })
  }, [tasks, onUpdate, onDelete, onSelect])
}
