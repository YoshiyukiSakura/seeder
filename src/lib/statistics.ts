/**
 * 统计数据查询模块
 * 提供访问数据库统计视图的类型安全接口
 */

import { prisma } from './prisma'

/**
 * 系统概览统计数据类型
 */
export interface SystemOverviewStats {
  totalUsers: bigint
  totalProjects: bigint
  totalPlans: bigint
  totalMasterPlans: bigint
  totalTasks: bigint
  totalConversations: bigint
  totalEstimateHours: number
  totalExecutions: bigint
  totalIssueExecutions: bigint
}

/**
 * 状态分布数据类型
 */
export interface StatusDistribution {
  status: string
  count: bigint
  percentage: number
}

/**
 * 任务优先级分布数据类型
 */
export interface TaskPriorityDistribution {
  priority: number
  taskCount: bigint
  percentage: number
  totalEstimateHours: number
  avgEstimateHours: number
}

/**
 * 用户统计数据类型
 */
export interface UserStatistics {
  userId: string
  username: string
  email: string | null
  userCreatedAt: Date
  projectCount: bigint
  planCount: bigint
  draftPlanCount: bigint
  reviewingPlanCount: bigint
  publishedPlanCount: bigint
  archivedPlanCount: bigint
  masterPlanCount: bigint
  taskCount: bigint
  priority1TaskCount: bigint
  priority2TaskCount: bigint
  priority3TaskCount: bigint
  priority4TaskCount: bigint
  priority5TaskCount: bigint
  totalEstimateHours: number
  avgEstimateHours: number
  conversationCount: bigint
  executionCount: bigint
  pendingExecutionCount: bigint
  runningExecutionCount: bigint
  completedExecutionCount: bigint
  failedExecutionCount: bigint
  issueExecutionCount: bigint
  completedIssueExecutionCount: bigint
}

/**
 * 项目统计数据类型
 */
export interface ProjectStatistics {
  projectId: string
  projectName: string
  userId: string
  ownerUsername: string
  projectCreatedAt: Date
  planCount: bigint
  draftPlanCount: bigint
  reviewingPlanCount: bigint
  publishedPlanCount: bigint
  archivedPlanCount: bigint
  masterPlanCount: bigint
  taskCount: bigint
  totalEstimateHours: number
  avgEstimateHours: number
  conversationCount: bigint
  executionCount: bigint
  completedExecutionCount: bigint
}

/**
 * 计划统计数据类型
 */
export interface PlanStatistics {
  planId: string
  planName: string
  planStatus: string
  projectId: string
  projectName: string
  userId: string
  taskCount: bigint
  priority1TaskCount: bigint
  priority2TaskCount: bigint
  priority3TaskCount: bigint
  priority4TaskCount: bigint
  priority5TaskCount: bigint
  totalEstimateHours: number
  avgEstimateHours: number
  conversationCount: bigint
  executionCount: bigint
  pendingExecutionCount: bigint
  runningExecutionCount: bigint
  completedExecutionCount: bigint
  failedExecutionCount: bigint
  createdAt: Date
  updatedAt: Date
  publishedAt: Date | null
}

/**
 * 任务标签分布数据类型
 */
export interface TaskLabelDistribution {
  label: string
  taskCount: bigint
  percentage: number
  avgEstimateHours: number
}

/**
 * 每日创建趋势数据类型
 */
export interface DailyCreationTrend {
  date: Date
  entity_type: string
  count: bigint
}

/**
 * 统计查询类
 */
export class StatisticsQueries {
  /**
   * 获取系统概览统计
   */
  static async getSystemOverview(): Promise<SystemOverviewStats | null> {
    const result = await prisma.$queryRaw<SystemOverviewStats[]>`
      SELECT * FROM "system_overview_stats"
    `
    return result[0] || null
  }

  /**
   * 获取计划状态分布
   */
  static async getPlanStatusDistribution(): Promise<StatusDistribution[]> {
    return await prisma.$queryRaw<StatusDistribution[]>`
      SELECT * FROM "plan_status_distribution"
    `
  }

  /**
   * 获取主计划状态分布
   */
  static async getMasterPlanStatusDistribution(): Promise<StatusDistribution[]> {
    return await prisma.$queryRaw<StatusDistribution[]>`
      SELECT * FROM "master_plan_status_distribution"
    `
  }

  /**
   * 获取任务优先级分布
   */
  static async getTaskPriorityDistribution(): Promise<TaskPriorityDistribution[]> {
    return await prisma.$queryRaw<TaskPriorityDistribution[]>`
      SELECT * FROM "task_priority_distribution"
    `
  }

  /**
   * 获取执行状态分布
   */
  static async getExecutionStatusDistribution(): Promise<StatusDistribution[]> {
    return await prisma.$queryRaw<StatusDistribution[]>`
      SELECT * FROM "execution_status_distribution"
    `
  }

  /**
   * 获取任务执行状态分布
   */
  static async getIssueExecutionStatusDistribution(): Promise<StatusDistribution[]> {
    return await prisma.$queryRaw<StatusDistribution[]>`
      SELECT * FROM "issue_execution_status_distribution"
    `
  }

  /**
   * 获取所有用户的统计数据
   */
  static async getAllUserStatistics(): Promise<UserStatistics[]> {
    return await prisma.$queryRaw<UserStatistics[]>`
      SELECT * FROM "user_statistics"
    `
  }

  /**
   * 获取特定用户的统计数据
   */
  static async getUserStatistics(userId: string): Promise<UserStatistics | null> {
    const result = await prisma.$queryRaw<UserStatistics[]>`
      SELECT * FROM "user_statistics" WHERE "userId" = ${userId}
    `
    return result[0] || null
  }

  /**
   * 获取所有项目的统计数据
   */
  static async getAllProjectStatistics(): Promise<ProjectStatistics[]> {
    return await prisma.$queryRaw<ProjectStatistics[]>`
      SELECT * FROM "project_statistics"
    `
  }

  /**
   * 获取特定项目的统计数据
   */
  static async getProjectStatistics(projectId: string): Promise<ProjectStatistics | null> {
    const result = await prisma.$queryRaw<ProjectStatistics[]>`
      SELECT * FROM "project_statistics" WHERE "projectId" = ${projectId}
    `
    return result[0] || null
  }

  /**
   * 获取特定用户的所有项目统计
   */
  static async getUserProjectStatistics(userId: string): Promise<ProjectStatistics[]> {
    return await prisma.$queryRaw<ProjectStatistics[]>`
      SELECT * FROM "project_statistics" WHERE "userId" = ${userId}
    `
  }

  /**
   * 获取所有计划的统计数据
   */
  static async getAllPlanStatistics(): Promise<PlanStatistics[]> {
    return await prisma.$queryRaw<PlanStatistics[]>`
      SELECT * FROM "plan_statistics"
    `
  }

  /**
   * 获取特定计划的统计数据
   */
  static async getPlanStatistics(planId: string): Promise<PlanStatistics | null> {
    const result = await prisma.$queryRaw<PlanStatistics[]>`
      SELECT * FROM "plan_statistics" WHERE "planId" = ${planId}
    `
    return result[0] || null
  }

  /**
   * 获取特定项目的所有计划统计
   */
  static async getProjectPlanStatistics(projectId: string): Promise<PlanStatistics[]> {
    return await prisma.$queryRaw<PlanStatistics[]>`
      SELECT * FROM "plan_statistics" WHERE "projectId" = ${projectId}
    `
  }

  /**
   * 获取任务标签分布
   */
  static async getTaskLabelDistribution(): Promise<TaskLabelDistribution[]> {
    return await prisma.$queryRaw<TaskLabelDistribution[]>`
      SELECT * FROM "task_label_distribution"
    `
  }

  /**
   * 获取每日创建趋势
   * @param days 查询最近多少天的数据，默认30天
   */
  static async getDailyCreationTrend(days: number = 30): Promise<DailyCreationTrend[]> {
    return await prisma.$queryRaw<DailyCreationTrend[]>`
      SELECT * FROM "daily_creation_trend"
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC, entity_type
    `
  }

  /**
   * 获取特定实体类型的每日创建趋势
   */
  static async getDailyCreationTrendByType(
    entityType: 'Plan' | 'Task' | 'Project' | 'Execution',
    days: number = 30
  ): Promise<DailyCreationTrend[]> {
    return await prisma.$queryRaw<DailyCreationTrend[]>`
      SELECT * FROM "daily_creation_trend"
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
        AND entity_type = ${entityType}
      ORDER BY date DESC
    `
  }

  /**
   * 获取完整的统计仪表板数据
   */
  static async getDashboardData() {
    const [
      overview,
      planStatus,
      masterPlanStatus,
      taskPriority,
      executionStatus,
      issueExecutionStatus,
      labelDistribution
    ] = await Promise.all([
      this.getSystemOverview(),
      this.getPlanStatusDistribution(),
      this.getMasterPlanStatusDistribution(),
      this.getTaskPriorityDistribution(),
      this.getExecutionStatusDistribution(),
      this.getIssueExecutionStatusDistribution(),
      this.getTaskLabelDistribution()
    ])

    return {
      overview,
      distributions: {
        planStatus,
        masterPlanStatus,
        taskPriority,
        executionStatus,
        issueExecutionStatus,
        labelDistribution
      }
    }
  }
}

/**
 * 便捷导出
 */
export const stats = StatisticsQueries
