# 统计数据库视图文档

本文档描述了为项目创建的统计数据库视图及其使用方法。

## 概述

系统提供了 11 个数据库视图用于统计分析，涵盖以下维度：

1. **系统概览** - 整体统计数据
2. **状态分布** - 计划、执行的状态分布
3. **优先级分布** - 任务优先级分布
4. **用户维度** - 按用户聚合的统计
5. **项目维度** - 按项目聚合的统计
6. **计划维度** - 按计划聚合的统计
7. **标签分布** - 任务标签使用频率
8. **时间趋势** - 每日创建数量趋势

## 数据库视图列表

### 1. system_overview_stats (系统概览统计)

提供系统级别的总体统计数据。

**字段:**
- `totalUsers` - 用户总数
- `totalProjects` - 项目总数
- `totalPlans` - 计划总数
- `totalMasterPlans` - 主计划总数
- `totalTasks` - 任务总数
- `totalConversations` - 对话总数
- `totalEstimateHours` - 预估工时总和
- `totalExecutions` - 执行总数
- `totalIssueExecutions` - 任务执行总数

**示例查询:**
```sql
SELECT * FROM system_overview_stats;
```

**TypeScript 用法:**
```typescript
import { stats } from '@/lib/statistics'

const overview = await stats.getSystemOverview()
console.log(overview.totalTasks)  // bigint
console.log(overview.totalEstimateHours)  // number
```

---

### 2. plan_status_distribution (计划状态分布)

统计各状态的计划数量及百分比。

**字段:**
- `status` - 计划状态 (DRAFT, REVIEWING, PUBLISHED, ARCHIVED)
- `count` - 该状态的计划数量
- `percentage` - 百分比

**示例查询:**
```sql
SELECT * FROM plan_status_distribution;
```

**TypeScript 用法:**
```typescript
const planStatus = await stats.getPlanStatusDistribution()
planStatus.forEach(s => {
  console.log(`${s.status}: ${s.count} (${s.percentage}%)`)
})
```

---

### 3. master_plan_status_distribution (主计划状态分布)

统计各状态的主计划数量及百分比。

**字段:**
- `status` - 主计划状态
- `count` - 数量
- `percentage` - 百分比

**TypeScript 用法:**
```typescript
const masterPlanStatus = await stats.getMasterPlanStatusDistribution()
```

---

### 4. task_priority_distribution (任务优先级分布)

统计各优先级的任务数量、百分比及工时信息。

**字段:**
- `priority` - 优先级 (0-5)
- `taskCount` - 任务数量
- `percentage` - 百分比
- `totalEstimateHours` - 该优先级的总工时
- `avgEstimateHours` - 该优先级的平均工时

**示例查询:**
```sql
SELECT * FROM task_priority_distribution ORDER BY priority;
```

**TypeScript 用法:**
```typescript
const taskPriority = await stats.getTaskPriorityDistribution()
taskPriority.forEach(p => {
  console.log(`Priority ${p.priority}: ${p.taskCount} tasks, ${p.totalEstimateHours}h total`)
})
```

---

### 5. execution_status_distribution (执行状态分布)

统计各执行状态的数量及百分比。

**字段:**
- `status` - 执行状态 (PENDING, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED)
- `count` - 数量
- `percentage` - 百分比

**TypeScript 用法:**
```typescript
const executionStatus = await stats.getExecutionStatusDistribution()
```

---

### 6. issue_execution_status_distribution (任务执行状态分布)

统计各任务执行状态的数量及百分比。

**字段:**
- `status` - 任务执行状态 (PENDING, WAITING_DEPS, RUNNING, COMPLETED, FAILED, SKIPPED)
- `count` - 数量
- `percentage` - 百分比

**TypeScript 用法:**
```typescript
const issueStatus = await stats.getIssueExecutionStatusDistribution()
```

---

### 7. user_statistics (用户维度统计)

按用户聚合所有相关统计数据。

**字段:**
- `userId` - 用户ID
- `username` - 用户名
- `email` - 邮箱
- `userCreatedAt` - 用户创建时间
- `projectCount` - 项目数量
- `planCount` - 计划总数
- `draftPlanCount` - 草稿计划数
- `reviewingPlanCount` - 审核中计划数
- `publishedPlanCount` - 已发布计划数
- `archivedPlanCount` - 已归档计划数
- `masterPlanCount` - 主计划数量
- `taskCount` - 任务总数
- `priority1TaskCount` - 优先级1任务数
- `priority2TaskCount` - 优先级2任务数
- `priority3TaskCount` - 优先级3任务数
- `priority4TaskCount` - 优先级4任务数
- `priority5TaskCount` - 优先级5任务数
- `totalEstimateHours` - 总预估工时
- `avgEstimateHours` - 平均预估工时
- `conversationCount` - 对话数量
- `executionCount` - 执行总数
- `pendingExecutionCount` - 待执行数
- `runningExecutionCount` - 执行中数
- `completedExecutionCount` - 已完成执行数
- `failedExecutionCount` - 失败执行数
- `issueExecutionCount` - 任务执行总数
- `completedIssueExecutionCount` - 已完成任务执行数

**示例查询:**
```sql
-- 获取所有用户统计
SELECT * FROM user_statistics;

-- 获取特定用户统计
SELECT * FROM user_statistics WHERE "userId" = 'xxx';
```

**TypeScript 用法:**
```typescript
// 获取所有用户统计
const allUsers = await stats.getAllUserStatistics()

// 获取特定用户统计
const userStat = await stats.getUserStatistics('user-id-here')
if (userStat) {
  console.log(`${userStat.username} has ${userStat.projectCount} projects`)
}
```

---

### 8. project_statistics (项目维度统计)

按项目聚合统计数据。

**字段:**
- `projectId` - 项目ID
- `projectName` - 项目名称
- `userId` - 所有者ID
- `ownerUsername` - 所有者用户名
- `projectCreatedAt` - 项目创建时间
- `planCount` - 计划总数
- `draftPlanCount` - 草稿计划数
- `reviewingPlanCount` - 审核中计划数
- `publishedPlanCount` - 已发布计划数
- `archivedPlanCount` - 已归档计划数
- `masterPlanCount` - 主计划数量
- `taskCount` - 任务总数
- `totalEstimateHours` - 总预估工时
- `avgEstimateHours` - 平均预估工时
- `conversationCount` - 对话数量
- `executionCount` - 执行总数
- `completedExecutionCount` - 已完成执行数

**示例查询:**
```sql
-- 获取所有项目统计
SELECT * FROM project_statistics;

-- 获取特定项目统计
SELECT * FROM project_statistics WHERE "projectId" = 'xxx';

-- 获取特定用户的项目统计
SELECT * FROM project_statistics WHERE "userId" = 'xxx';
```

**TypeScript 用法:**
```typescript
// 获取所有项目统计
const allProjects = await stats.getAllProjectStatistics()

// 获取特定项目统计
const projectStat = await stats.getProjectStatistics('project-id')

// 获取用户的所有项目统计
const userProjects = await stats.getUserProjectStatistics('user-id')
```

---

### 9. plan_statistics (计划维度统计)

按计划聚合任务和执行数据。

**字段:**
- `planId` - 计划ID
- `planName` - 计划名称
- `planStatus` - 计划状态
- `projectId` - 项目ID
- `projectName` - 项目名称
- `userId` - 所有者ID
- `taskCount` - 任务总数
- `priority1TaskCount` - 优先级1任务数
- `priority2TaskCount` - 优先级2任务数
- `priority3TaskCount` - 优先级3任务数
- `priority4TaskCount` - 优先级4任务数
- `priority5TaskCount` - 优先级5任务数
- `totalEstimateHours` - 总预估工时
- `avgEstimateHours` - 平均预估工时
- `conversationCount` - 对话数量
- `executionCount` - 执行总数
- `pendingExecutionCount` - 待执行数
- `runningExecutionCount` - 执行中数
- `completedExecutionCount` - 已完成数
- `failedExecutionCount` - 失败数
- `createdAt` - 创建时间
- `updatedAt` - 更新时间
- `publishedAt` - 发布时间

**示例查询:**
```sql
-- 获取所有计划统计
SELECT * FROM plan_statistics;

-- 获取特定计划统计
SELECT * FROM plan_statistics WHERE "planId" = 'xxx';

-- 获取特定项目的计划统计
SELECT * FROM plan_statistics WHERE "projectId" = 'xxx';
```

**TypeScript 用法:**
```typescript
// 获取所有计划统计
const allPlans = await stats.getAllPlanStatistics()

// 获取特定计划统计
const planStat = await stats.getPlanStatistics('plan-id')

// 获取项目的所有计划统计
const projectPlans = await stats.getProjectPlanStatistics('project-id')
```

---

### 10. task_label_distribution (任务标签分布)

统计各标签的使用频率。

**字段:**
- `label` - 标签名称
- `taskCount` - 使用该标签的任务数
- `percentage` - 百分比
- `avgEstimateHours` - 该标签任务的平均工时

**示例查询:**
```sql
SELECT * FROM task_label_distribution ORDER BY "taskCount" DESC;
```

**TypeScript 用法:**
```typescript
const labelDist = await stats.getTaskLabelDistribution()
labelDist.forEach(l => {
  console.log(`${l.label}: ${l.taskCount} tasks (${l.percentage}%)`)
})
```

---

### 11. daily_creation_trend (每日创建趋势)

统计每日创建的计划、任务、项目、执行的数量趋势。

**字段:**
- `date` - 日期
- `entity_type` - 实体类型 (Plan, Task, Project, Execution)
- `count` - 创建数量

**示例查询:**
```sql
-- 查询最近30天的趋势
SELECT * FROM daily_creation_trend
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC, entity_type;

-- 查询特定类型的趋势
SELECT * FROM daily_creation_trend
WHERE entity_type = 'Plan' AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

**TypeScript 用法:**
```typescript
// 获取最近30天的趋势
const trend = await stats.getDailyCreationTrend(30)

// 获取特定类型的趋势
const planTrend = await stats.getDailyCreationTrendByType('Plan', 7)
```

---

## TypeScript API 使用指南

### 导入模块

```typescript
import { stats, StatisticsQueries } from '@/lib/statistics'
```

### 获取完整仪表板数据

一次性获取所有分布数据，适合仪表板页面：

```typescript
const dashboard = await stats.getDashboardData()

console.log(dashboard.overview)  // 系统概览
console.log(dashboard.distributions.planStatus)  // 计划状态分布
console.log(dashboard.distributions.taskPriority)  // 任务优先级分布
console.log(dashboard.distributions.executionStatus)  // 执行状态分布
console.log(dashboard.distributions.issueExecutionStatus)  // 任务执行状态分布
console.log(dashboard.distributions.labelDistribution)  // 标签分布
```

### 类型定义

所有返回类型都有完整的 TypeScript 类型定义，请参考 `src/lib/statistics.ts`。

主要类型：
- `SystemOverviewStats`
- `StatusDistribution`
- `TaskPriorityDistribution`
- `UserStatistics`
- `ProjectStatistics`
- `PlanStatistics`
- `TaskLabelDistribution`
- `DailyCreationTrend`

### 注意事项

1. **BigInt 处理**: 许多计数字段返回 `bigint` 类型，在前端显示时需要转换为字符串：
   ```typescript
   const count = overview.totalUsers.toString()
   ```

2. **可选字段**: 某些字段可能为 `null`，使用前请检查：
   ```typescript
   const overview = await stats.getSystemOverview()
   if (overview) {
     console.log(overview.totalUsers)
   }
   ```

3. **性能考虑**: 视图查询已优化，但对于大数据量，建议：
   - 使用缓存（Redis）
   - 定期预计算结果
   - 按需查询特定维度

---

## 示例应用场景

### 1. 构建统计仪表板

```typescript
async function buildDashboard() {
  const dashboard = await stats.getDashboardData()

  return {
    summary: {
      users: Number(dashboard.overview?.totalUsers),
      projects: Number(dashboard.overview?.totalProjects),
      plans: Number(dashboard.overview?.totalPlans),
      tasks: Number(dashboard.overview?.totalTasks),
      totalHours: dashboard.overview?.totalEstimateHours
    },
    charts: {
      planStatusChart: dashboard.distributions.planStatus,
      priorityChart: dashboard.distributions.taskPriority,
      executionChart: dashboard.distributions.executionStatus
    }
  }
}
```

### 2. 用户个人统计页面

```typescript
async function getUserDashboard(userId: string) {
  const userStats = await stats.getUserStatistics(userId)
  const userProjects = await stats.getUserProjectStatistics(userId)

  return {
    profile: {
      username: userStats?.username,
      projectCount: Number(userStats?.projectCount),
      totalTasks: Number(userStats?.taskCount),
      totalHours: userStats?.totalEstimateHours
    },
    projects: userProjects.map(p => ({
      name: p.projectName,
      planCount: Number(p.planCount),
      taskCount: Number(p.taskCount),
      hours: p.totalEstimateHours
    }))
  }
}
```

### 3. 项目进度跟踪

```typescript
async function getProjectProgress(projectId: string) {
  const projectStats = await stats.getProjectStatistics(projectId)
  const planStats = await stats.getProjectPlanStatistics(projectId)

  return {
    overview: {
      totalPlans: Number(projectStats?.planCount),
      publishedPlans: Number(projectStats?.publishedPlanCount),
      totalTasks: Number(projectStats?.taskCount),
      totalHours: projectStats?.totalEstimateHours
    },
    plans: planStats.map(p => ({
      name: p.planName,
      status: p.planStatus,
      tasks: Number(p.taskCount),
      completedExecutions: Number(p.completedExecutionCount)
    }))
  }
}
```

### 4. 趋势分析

```typescript
async function analyzeTrends() {
  const trend = await stats.getDailyCreationTrend(30)

  // 按实体类型分组
  const grouped = trend.reduce((acc, item) => {
    if (!acc[item.entity_type]) {
      acc[item.entity_type] = []
    }
    acc[item.entity_type].push({
      date: item.date,
      count: Number(item.count)
    })
    return acc
  }, {} as Record<string, Array<{date: Date, count: number}>>)

  return grouped
}
```

---

## 维护和扩展

### 添加新视图

1. 在 `prisma/migrations/` 中创建新的迁移文件
2. 在 `src/lib/statistics.ts` 中添加相应的类型和查询方法
3. 运行测试验证

### 更新现有视图

1. 创建新的迁移文件
2. 使用 `DROP VIEW IF EXISTS ... CASCADE` 删除旧视图
3. 使用 `CREATE VIEW` 创建新视图
4. 更新 TypeScript 类型定义

### 性能优化建议

1. **添加索引**: 视图中使用的 JOIN 字段已有索引
2. **物化视图**: 对于复杂查询，可考虑使用 PostgreSQL 的 MATERIALIZED VIEW
3. **缓存**: 使用 Redis 缓存查询结果
4. **分页**: 对于大量数据，使用 LIMIT 和 OFFSET

---

## 测试

运行测试脚本验证所有视图：

```bash
npx tsx test-statistics.ts
```

测试覆盖：
- 所有视图的基本查询
- TypeScript API 的所有方法
- 数据类型转换
- 边界情况处理

---

## 问题排查

### 视图不存在

```bash
# 重新运行迁移
npx prisma db execute --file prisma/migrations/20260120_add_statistics_views/migration.sql
```

### 数据不准确

```bash
# 检查数据库连接
npx prisma db pull

# 查看原始数据
npx prisma studio
```

### TypeScript 类型错误

确保使用正确的类型转换：
```typescript
// BigInt 需要转换为字符串或数字
const count = Number(result.count)
// 或
const count = result.count.toString()
```
