/**
 * 依赖关系工具函数
 * 用于检测循环依赖和验证依赖关系
 */

export interface TaskWithDependencies {
  id: string
  blockedBy?: string[]
}

/**
 * 检测是否会形成循环依赖
 *
 * @param taskId - 当前任务 ID
 * @param newBlockedBy - 新的 blockedBy 数组（要设置的值）
 * @param allTasks - 所有任务列表
 * @returns 如果会形成循环返回 true，否则返回 false
 *
 * 算法：使用 DFS 遍历从 newBlockedBy 中的每个任务开始的依赖链
 * 如果在任何路径中遇到当前任务 ID，则说明会形成循环
 */
export function detectCycle(
  taskId: string,
  newBlockedBy: string[],
  allTasks: TaskWithDependencies[]
): boolean {
  // 构建任务 ID 到任务的映射
  const taskMap = new Map<string, TaskWithDependencies>()
  for (const task of allTasks) {
    taskMap.set(task.id, task)
  }

  // DFS 遍历检测循环
  const visited = new Set<string>()
  const stack = [...newBlockedBy]

  while (stack.length > 0) {
    const currentId = stack.pop()!

    // 如果遇到当前任务，说明会形成循环
    if (currentId === taskId) {
      return true
    }

    // 如果已经访问过，跳过
    if (visited.has(currentId)) {
      continue
    }
    visited.add(currentId)

    // 获取当前任务的 blockedBy，继续遍历
    const task = taskMap.get(currentId)
    if (task?.blockedBy) {
      stack.push(...task.blockedBy)
    }
  }

  return false
}

/**
 * 获取循环依赖的路径（用于显示错误信息）
 *
 * @param taskId - 当前任务 ID
 * @param newBlockedBy - 新的 blockedBy 数组
 * @param allTasks - 所有任务列表
 * @returns 循环路径数组，如果没有循环返回空数组
 */
export function getCyclePath(
  taskId: string,
  newBlockedBy: string[],
  allTasks: TaskWithDependencies[]
): string[] {
  const taskMap = new Map<string, TaskWithDependencies>()
  for (const task of allTasks) {
    taskMap.set(task.id, task)
  }

  // DFS with path tracking
  function dfs(currentId: string, path: string[]): string[] | null {
    if (currentId === taskId) {
      return [...path, currentId]
    }

    if (path.includes(currentId)) {
      return null // 访问过但不是目标，跳过
    }

    const task = taskMap.get(currentId)
    if (!task?.blockedBy) {
      return null
    }

    for (const blockerId of task.blockedBy) {
      const result = dfs(blockerId, [...path, currentId])
      if (result) {
        return result
      }
    }

    return null
  }

  // 从每个 newBlockedBy 开始搜索
  for (const blockerId of newBlockedBy) {
    const result = dfs(blockerId, [taskId])
    if (result) {
      return result
    }
  }

  return []
}

/**
 * 验证 blockedBy 更新是否有效
 *
 * @param taskId - 当前任务 ID
 * @param newBlockedBy - 新的 blockedBy 数组
 * @param allTasks - 所有任务列表
 * @returns 验证结果 { valid: boolean, error?: string }
 */
export function validateBlockedBy(
  taskId: string,
  newBlockedBy: string[],
  allTasks: TaskWithDependencies[]
): { valid: boolean; error?: string } {
  // 检查是否包含自身
  if (newBlockedBy.includes(taskId)) {
    return { valid: false, error: 'A task cannot block itself' }
  }

  // 检查循环依赖
  if (detectCycle(taskId, newBlockedBy, allTasks)) {
    const cyclePath = getCyclePath(taskId, newBlockedBy, allTasks)
    if (cyclePath.length > 0) {
      return {
        valid: false,
        error: `Circular dependency detected: ${cyclePath.join(' -> ')}`
      }
    }
    return { valid: false, error: 'Circular dependency detected' }
  }

  return { valid: true }
}
