export interface Task {
  id: string
  title: string
  description: string
  priority: number
  labels: string[]
  acceptanceCriteria: string[]
  relatedFiles: string[]
  estimateHours?: number
  sortOrder?: number
  dependsOnId?: string | null
  blockedBy?: string[]  // 阻塞该任务的其他任务 ID 数组
  // 画布位置
  position?: {
    x: number
    y: number
  }
}

// 任务依赖边 (用于画布视图)
export interface TaskDependencyEdge {
  id: string
  source: string      // blocker 任务 ID
  target: string      // 被阻塞的任务 ID
  type?: 'default' | 'smoothstep' | 'step'
}

export type TaskUpdateHandler = (taskId: string, updates: Partial<Task>) => void
export type TaskDeleteHandler = (taskId: string) => void
