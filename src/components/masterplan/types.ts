/**
 * MasterPlan 相关类型定义
 */

export type MasterPlanStatus = 'DRAFT' | 'REVIEWING' | 'PUBLISHED' | 'ARCHIVED'
export type PlanStatus = 'DRAFT' | 'REVIEWING' | 'PUBLISHED' | 'ARCHIVED'

export interface MasterPlan {
  id: string
  projectId: string
  name: string
  description?: string
  status: MasterPlanStatus
  publishedAt?: string
  createdAt: string
  updatedAt: string
  planCount?: number
  plans: PlanSummary[]
  project?: {
    id: string
    name: string
  }
}

export interface PlanSummary {
  id: string
  name: string
  description?: string
  status: PlanStatus
  blockedByPlanIds: string[]
  sortOrder: number
  taskCount: number
  totalEstimate?: number
  completedTaskCount?: number
  publishedAt?: string
  createdAt?: string
}

export interface MasterPlanListItem {
  id: string
  projectId: string
  name: string
  description?: string
  status: MasterPlanStatus
  planCount: number
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateMasterPlanRequest {
  name: string
  description?: string
}

export interface UpdateMasterPlanRequest {
  name?: string
  description?: string
  status?: MasterPlanStatus
}

export interface AddPlanToMasterPlanRequest {
  planId: string
  sortOrder?: number
  blockedByPlanIds?: string[]
}

export interface UpdatePlansInMasterPlanRequest {
  plans: Array<{
    id: string
    sortOrder?: number
    blockedByPlanIds?: string[]
  }>
}

export interface MasterPlanApiResponse {
  masterPlan: MasterPlan
}

export interface MasterPlanListApiResponse {
  masterPlans: MasterPlanListItem[]
}

export interface PlansUpdateApiResponse {
  plans: PlanSummary[]
}

// Canvas 相关类型
export interface PlanNodeData {
  id: string
  name: string
  description?: string
  status: PlanStatus
  blockedByPlanIds: string[]
  taskCount: number
  totalEstimate?: number
  isSelected?: boolean
}

export interface PlanNodePosition {
  x: number
  y: number
}

export interface PlanDependencyEdge {
  id: string
  source: string
  target: string
}
