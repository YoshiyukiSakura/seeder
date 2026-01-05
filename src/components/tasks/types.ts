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
}

export type TaskUpdateHandler = (taskId: string, updates: Partial<Task>) => void
export type TaskDeleteHandler = (taskId: string) => void
