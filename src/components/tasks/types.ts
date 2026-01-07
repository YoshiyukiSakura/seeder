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
}

export type TaskUpdateHandler = (taskId: string, updates: Partial<Task>) => void
export type TaskDeleteHandler = (taskId: string) => void
