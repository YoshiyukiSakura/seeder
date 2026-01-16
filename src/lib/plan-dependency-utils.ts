/**
 * Plan 依赖关系工具函数
 * 用于验证 Plan 间的依赖关系是否有效
 */

/**
 * 检测 Plan 间的循环依赖
 * @param dependencyMap - Plan ID 到其被阻塞的 Plan ID 列表的映射
 * @returns 如果有循环依赖，返回循环路径；否则返回 null
 */
export function detectPlanCycle(dependencyMap: Record<string, string[]>): string[] | null {
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfs(planId: string): string[] | null {
    visited.add(planId)
    recursionStack.add(planId)
    path.push(planId)

    const blockedByIds = dependencyMap[planId] || []

    for (const blockedById of blockedByIds) {
      if (!visited.has(blockedById)) {
        const result = dfs(blockedById)
        if (result) return result
      } else if (recursionStack.has(blockedById)) {
        // 找到循环，返回循环路径
        const cycleStart = path.indexOf(blockedById)
        return [...path.slice(cycleStart), blockedById]
      }
    }

    recursionStack.delete(planId)
    path.pop()
    return null
  }

  // 从所有节点开始检测
  for (const planId of Object.keys(dependencyMap)) {
    if (!visited.has(planId)) {
      const cycle = dfs(planId)
      if (cycle) return cycle
    }
  }

  return null
}

/**
 * 验证 Plan 的 blockedByPlanIds 是否有效
 * @param planId - 要验证的 Plan ID
 * @param blockedByPlanIds - 被阻塞的 Plan ID 列表
 * @param validPlanIds - 有效的 Plan ID 集合
 * @returns 验证结果
 */
export function validatePlanBlockedBy(
  planId: string,
  blockedByPlanIds: string[],
  validPlanIds: Set<string>
): { valid: boolean; error?: string } {
  // 不能自己阻塞自己
  if (blockedByPlanIds.includes(planId)) {
    return { valid: false, error: 'A plan cannot block itself' }
  }

  // 验证所有 blockedByPlanIds 都是有效的 Plan ID
  for (const blockedById of blockedByPlanIds) {
    if (!validPlanIds.has(blockedById)) {
      return { valid: false, error: `Invalid blocked by plan ID: ${blockedById}` }
    }
  }

  return { valid: true }
}

/**
 * 获取 Plan 的执行顺序
 * 使用拓扑排序确定哪些 Plan 可以并行执行
 * @param plans - Plan 列表，包含 id 和 blockedByPlanIds
 * @returns 执行顺序分组，每组可以并行执行
 */
export function getPlanExecutionOrder(
  plans: Array<{ id: string; blockedByPlanIds: string[] }>
): string[][] {
  // 构建入度映射和依赖图
  const inDegree: Record<string, number> = {}
  const dependents: Record<string, string[]> = {}
  const planIds = new Set(plans.map((p) => p.id))

  // 初始化
  for (const plan of plans) {
    inDegree[plan.id] = 0
    dependents[plan.id] = []
  }

  // 计算入度和依赖关系
  for (const plan of plans) {
    for (const blockedById of plan.blockedByPlanIds) {
      if (planIds.has(blockedById)) {
        inDegree[plan.id]++
        dependents[blockedById].push(plan.id)
      }
    }
  }

  const result: string[][] = []
  const remaining = new Set(planIds)

  // 按批次处理
  while (remaining.size > 0) {
    // 找出所有入度为 0 的节点（可以并行执行）
    const batch: string[] = []
    for (const planId of remaining) {
      if (inDegree[planId] === 0) {
        batch.push(planId)
      }
    }

    if (batch.length === 0) {
      // 有循环依赖，无法继续
      console.error('Circular dependency detected in plan execution order')
      break
    }

    result.push(batch)

    // 从剩余集合中移除本批次的节点，并更新入度
    for (const planId of batch) {
      remaining.delete(planId)
      for (const dependentId of dependents[planId]) {
        inDegree[dependentId]--
      }
    }
  }

  return result
}

/**
 * 检查 Plan 是否可以执行（所有依赖都已完成）
 * @param planId - 要检查的 Plan ID
 * @param blockedByPlanIds - 被阻塞的 Plan ID 列表
 * @param completedPlanIds - 已完成的 Plan ID 集合
 * @returns 是否可以执行
 */
export function canPlanExecute(
  planId: string,
  blockedByPlanIds: string[],
  completedPlanIds: Set<string>
): boolean {
  return blockedByPlanIds.every((id) => completedPlanIds.has(id))
}
