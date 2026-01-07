/**
 * Linear 发布逻辑
 * 将 Seeder 任务发布到 Linear
 */
import { LinearClient } from '@linear/sdk'

export interface TaskToPublish {
  id: string
  title: string
  description: string
  priority: number
  labels: string[]
  acceptanceCriteria: string[]
  relatedFiles: string[]
  estimateHours: number | null
  blockedBy?: string[]  // 阻塞该任务的其他任务 ID 数组
}

export interface PublishOptions {
  teamId: string
  projectId?: string
  createMetaIssue: boolean
  planName: string
}

export interface PublishedIssue {
  taskId: string
  linearIssueId: string
  linearIssueUrl: string
  identifier: string
}

export interface PublishResult {
  success: boolean
  issues: PublishedIssue[]
  metaIssue?: {
    id: string
    url: string
    identifier: string
  }
  errors: string[]
}

// 优先级映射: Seeder (0-3) -> Linear (1-4)
// Seeder: 0=P0紧急, 1=P1高, 2=P2中, 3=P3低
// Linear: 0=无, 1=Urgent, 2=High, 3=Medium, 4=Low
const PRIORITY_MAP: Record<number, number> = {
  0: 1, // P0 -> Urgent
  1: 2, // P1 -> High
  2: 3, // P2 -> Medium
  3: 4, // P3 -> Low
}

/**
 * 发布任务到 Linear
 */
export async function publishToLinear(
  client: LinearClient,
  tasks: TaskToPublish[],
  options: PublishOptions
): Promise<PublishResult> {
  const results: PublishedIssue[] = []
  const errors: string[] = []

  // 1. 批量创建 Issues
  for (const task of tasks) {
    try {
      const description = formatIssueDescription(task)

      const issuePayload = await client.createIssue({
        teamId: options.teamId,
        projectId: options.projectId || undefined,
        title: task.title,
        description,
        priority: PRIORITY_MAP[task.priority] ?? 3,
        estimate: task.estimateHours ?? undefined,
      })

      if (issuePayload.success) {
        const issue = await issuePayload.issue
        if (issue) {
          results.push({
            taskId: task.id,
            linearIssueId: issue.id,
            linearIssueUrl: issue.url,
            identifier: issue.identifier,
          })
        }
      } else {
        errors.push(`Failed to create issue for task: ${task.title}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Error creating issue "${task.title}": ${message}`)
    }
  }

  // 2. 设置 Blocks 关系
  // 建立 taskId -> linearIssueId 的映射
  const taskToIssueMap = new Map<string, string>()
  for (const result of results) {
    taskToIssueMap.set(result.taskId, result.linearIssueId)
  }

  // 遍历所有任务，设置 blocks 关系
  for (const task of tasks) {
    if (task.blockedBy && task.blockedBy.length > 0) {
      const blockedIssueId = taskToIssueMap.get(task.id)
      if (!blockedIssueId) continue

      for (const blockingTaskId of task.blockedBy) {
        const blockingIssueId = taskToIssueMap.get(blockingTaskId)
        if (!blockingIssueId) continue

        try {
          // 创建 blocks 关系：blockingIssue blocks blockedIssue
          await client.issueRelationCreate({
            issueId: blockingIssueId,
            relatedIssueId: blockedIssueId,
            type: 'blocks',
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Error creating block relation: ${message}`)
        }
      }
    }
  }

  // 3. 创建 META Issue (可选)
  let metaIssue: PublishResult['metaIssue']
  if (options.createMetaIssue && results.length > 0) {
    try {
      const metaDescription = formatMetaIssueDescription(options.planName, tasks, results)

      const metaPayload = await client.createIssue({
        teamId: options.teamId,
        projectId: options.projectId || undefined,
        title: `📋 ${options.planName}`,
        description: metaDescription,
        priority: 2, // High priority for tracking
      })

      if (metaPayload.success) {
        const issue = await metaPayload.issue
        if (issue) {
          metaIssue = {
            id: issue.id,
            url: issue.url,
            identifier: issue.identifier,
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Error creating META issue: ${message}`)
    }
  }

  return {
    success: results.length === tasks.length && errors.length === 0,
    issues: results,
    metaIssue,
    errors,
  }
}

/**
 * 格式化单个 Issue 的描述
 */
function formatIssueDescription(task: TaskToPublish): string {
  let description = task.description || ''

  if (task.acceptanceCriteria?.length > 0) {
    description += '\n\n## 验收标准\n'
    description += task.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n')
  }

  if (task.relatedFiles?.length > 0) {
    description += '\n\n## 相关文件\n'
    description += task.relatedFiles.map(f => `- \`${f}\``).join('\n')
  }

  description += '\n\n---\n*由 Seeder 自动创建*'

  return description
}

/**
 * 格式化 META Issue 的描述
 */
function formatMetaIssueDescription(
  planName: string,
  tasks: TaskToPublish[],
  publishedIssues: PublishedIssue[]
): string {
  const p0Count = tasks.filter(t => t.priority === 0).length
  const p1Count = tasks.filter(t => t.priority === 1).length
  const p2Count = tasks.filter(t => t.priority === 2).length
  const p3Count = tasks.filter(t => t.priority === 3).length
  const totalHours = tasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0)

  let description = `# 计划摘要: ${planName}\n\n`

  description += `## 任务统计\n`
  description += `- 总任务数: ${tasks.length}\n`
  description += `- P0 (紧急): ${p0Count}\n`
  description += `- P1 (高): ${p1Count}\n`
  description += `- P2 (中): ${p2Count}\n`
  description += `- P3 (低): ${p3Count}\n`
  if (totalHours > 0) {
    description += `- 总预估工时: ${totalHours}h\n`
  }
  description += '\n'

  description += `## 任务列表\n`
  publishedIssues.forEach((issue) => {
    const task = tasks.find(t => t.id === issue.taskId)
    description += `- [ ] ${issue.identifier} ${task?.title || ''}\n`
  })

  description += '\n---\n*由 Seeder 生成*'

  return description
}
