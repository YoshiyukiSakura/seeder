# Seedbed 与 Farmer 集成说明

## 架构

```
Seedbed (创建计划) ──┐
                     ├──→ PostgreSQL (共享)
Farmer (执行计划)  ──┘
```

## 数据职责

| 表 | 归属 | 说明 |
|---|------|------|
| Plan, Task | Seedbed 写 | 计划和任务定义 |
| Execution, IssueExecution | Farmer 写 | 执行状态和日志 |

## 待补充功能

**UI 追踪执行状态**：在 Task 列表/详情页显示执行进度

查询方式：
```sql
SELECT status, gitStatus, prUrl, error, startedAt, completedAt
FROM IssueExecution
WHERE taskId = ?
ORDER BY createdAt DESC
LIMIT 1
```

状态映射：
- `PENDING` → 待执行
- `RUNNING` → 执行中
- `COMPLETED` → 已完成（显示 PR 链接）
- `FAILED` → 失败（显示错误信息）
- `SKIPPED` → 跳过（依赖任务失败）

## 环境变量

必须与 Farmer 一致：
```env
DATABASE_URL=postgresql://...
AUTH_SECRET=xxx
```

## 启动

```bash
pm2 start ecosystem.config.js
```
