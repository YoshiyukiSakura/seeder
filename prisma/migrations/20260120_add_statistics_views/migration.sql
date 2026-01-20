-- CreateView: 统计数据视图
-- 此迁移创建用于统计分析的数据库视图

-- 先删除所有可能存在的旧视图
DROP VIEW IF EXISTS "system_overview_stats" CASCADE;
DROP VIEW IF EXISTS "plan_status_distribution" CASCADE;
DROP VIEW IF EXISTS "master_plan_status_distribution" CASCADE;
DROP VIEW IF EXISTS "task_priority_distribution" CASCADE;
DROP VIEW IF EXISTS "execution_status_distribution" CASCADE;
DROP VIEW IF EXISTS "issue_execution_status_distribution" CASCADE;
DROP VIEW IF EXISTS "user_statistics" CASCADE;
DROP VIEW IF EXISTS "project_statistics" CASCADE;
DROP VIEW IF EXISTS "plan_statistics" CASCADE;
DROP VIEW IF EXISTS "task_label_distribution" CASCADE;
DROP VIEW IF EXISTS "daily_creation_trend" CASCADE;

-- =============================================
-- 1. 系统概览统计视图
-- =============================================
-- 提供系统级别的总体统计数据
CREATE VIEW "system_overview_stats" AS
SELECT
    -- 用户统计
    (SELECT COUNT(*) FROM "User") as "totalUsers",

    -- 项目统计
    (SELECT COUNT(*) FROM "Project") as "totalProjects",

    -- 计划统计
    (SELECT COUNT(*) FROM "Plan") as "totalPlans",
    (SELECT COUNT(*) FROM "MasterPlan") as "totalMasterPlans",

    -- 任务统计
    (SELECT COUNT(*) FROM "Task") as "totalTasks",

    -- 对话统计
    (SELECT COUNT(*) FROM "Conversation") as "totalConversations",

    -- 预估工时总和
    (SELECT COALESCE(SUM("estimateHours"), 0) FROM "Task") as "totalEstimateHours",

    -- 执行统计
    (SELECT COUNT(*) FROM "Execution") as "totalExecutions",
    (SELECT COUNT(*) FROM "IssueExecution") as "totalIssueExecutions";


-- =============================================
-- 2. 计划状态分布视图
-- =============================================
-- 统计各状态的计划数量
CREATE VIEW "plan_status_distribution" AS
SELECT
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM "Plan"), 2) as percentage
FROM "Plan"
GROUP BY status
ORDER BY count DESC;


-- =============================================
-- 3. 主计划状态分布视图
-- =============================================
-- 统计各状态的主计划数量
CREATE VIEW "master_plan_status_distribution" AS
SELECT
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "MasterPlan"), 0), 2) as percentage
FROM "MasterPlan"
GROUP BY status
ORDER BY count DESC;


-- =============================================
-- 4. 任务优先级分布视图
-- =============================================
-- 统计各优先级的任务数量及工时
CREATE VIEW "task_priority_distribution" AS
SELECT
    priority,
    COUNT(*) as "taskCount",
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM "Task"), 2) as percentage,
    COALESCE(SUM("estimateHours"), 0) as "totalEstimateHours",
    COALESCE(AVG("estimateHours"), 0) as "avgEstimateHours"
FROM "Task"
GROUP BY priority
ORDER BY priority;


-- =============================================
-- 5. 执行状态分布视图
-- =============================================
-- 统计各执行状态的数量
CREATE VIEW "execution_status_distribution" AS
SELECT
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "Execution"), 0), 2) as percentage
FROM "Execution"
GROUP BY status
ORDER BY count DESC;


-- =============================================
-- 6. 任务执行状态分布视图
-- =============================================
-- 统计各任务执行状态的数量
CREATE VIEW "issue_execution_status_distribution" AS
SELECT
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "IssueExecution"), 0), 2) as percentage
FROM "IssueExecution"
GROUP BY status
ORDER BY count DESC;


-- =============================================
-- 7. 用户维度详细统计视图
-- =============================================
-- 按用户聚合所有相关统计数据
CREATE VIEW "user_statistics" AS
SELECT
    u.id as "userId",
    u."slackUsername" as username,
    u.email,
    u."createdAt" as "userCreatedAt",

    -- 项目统计
    COUNT(DISTINCT p.id) as "projectCount",

    -- 计划统计
    COUNT(DISTINCT pl.id) as "planCount",
    COUNT(DISTINCT CASE WHEN pl.status = 'DRAFT' THEN pl.id END) as "draftPlanCount",
    COUNT(DISTINCT CASE WHEN pl.status = 'REVIEWING' THEN pl.id END) as "reviewingPlanCount",
    COUNT(DISTINCT CASE WHEN pl.status = 'PUBLISHED' THEN pl.id END) as "publishedPlanCount",
    COUNT(DISTINCT CASE WHEN pl.status = 'ARCHIVED' THEN pl.id END) as "archivedPlanCount",

    -- 主计划统计
    COUNT(DISTINCT mp.id) as "masterPlanCount",

    -- 任务统计
    COUNT(DISTINCT t.id) as "taskCount",

    -- 任务优先级统计
    COUNT(DISTINCT CASE WHEN t.priority = 1 THEN t.id END) as "priority1TaskCount",
    COUNT(DISTINCT CASE WHEN t.priority = 2 THEN t.id END) as "priority2TaskCount",
    COUNT(DISTINCT CASE WHEN t.priority = 3 THEN t.id END) as "priority3TaskCount",
    COUNT(DISTINCT CASE WHEN t.priority = 4 THEN t.id END) as "priority4TaskCount",
    COUNT(DISTINCT CASE WHEN t.priority = 5 THEN t.id END) as "priority5TaskCount",

    -- 工时统计
    COALESCE(SUM(t."estimateHours"), 0) as "totalEstimateHours",
    COALESCE(AVG(t."estimateHours"), 0) as "avgEstimateHours",

    -- 对话统计
    COUNT(DISTINCT c.id) as "conversationCount",

    -- 执行统计
    COUNT(DISTINCT e.id) as "executionCount",
    COUNT(DISTINCT CASE WHEN e.status = 'PENDING' THEN e.id END) as "pendingExecutionCount",
    COUNT(DISTINCT CASE WHEN e.status = 'RUNNING' THEN e.id END) as "runningExecutionCount",
    COUNT(DISTINCT CASE WHEN e.status = 'COMPLETED' THEN e.id END) as "completedExecutionCount",
    COUNT(DISTINCT CASE WHEN e.status = 'FAILED' THEN e.id END) as "failedExecutionCount",

    -- 任务执行统计
    COUNT(DISTINCT ie.id) as "issueExecutionCount",
    COUNT(DISTINCT CASE WHEN ie.status = 'COMPLETED' THEN ie.id END) as "completedIssueExecutionCount"

FROM "User" u
LEFT JOIN "Project" p ON u.id = p."userId"
LEFT JOIN "Plan" pl ON p.id = pl."projectId"
LEFT JOIN "MasterPlan" mp ON p.id = mp."projectId"
LEFT JOIN "Task" t ON pl.id = t."planId"
LEFT JOIN "Conversation" c ON pl.id = c."planId"
LEFT JOIN "Execution" e ON pl.id = e."planId"
LEFT JOIN "IssueExecution" ie ON e.id = ie."executionId"
GROUP BY u.id, u."slackUsername", u.email, u."createdAt"
ORDER BY "projectCount" DESC, "planCount" DESC;


-- =============================================
-- 8. 项目维度统计视图
-- =============================================
-- 按项目聚合统计数据
CREATE VIEW "project_statistics" AS
SELECT
    p.id as "projectId",
    p.name as "projectName",
    p."userId",
    u."slackUsername" as "ownerUsername",
    p."createdAt" as "projectCreatedAt",

    -- 计划统计
    COUNT(DISTINCT pl.id) as "planCount",
    COUNT(DISTINCT CASE WHEN pl.status = 'DRAFT' THEN pl.id END) as "draftPlanCount",
    COUNT(DISTINCT CASE WHEN pl.status = 'REVIEWING' THEN pl.id END) as "reviewingPlanCount",
    COUNT(DISTINCT CASE WHEN pl.status = 'PUBLISHED' THEN pl.id END) as "publishedPlanCount",
    COUNT(DISTINCT CASE WHEN pl.status = 'ARCHIVED' THEN pl.id END) as "archivedPlanCount",

    -- 主计划统计
    COUNT(DISTINCT mp.id) as "masterPlanCount",

    -- 任务统计
    COUNT(DISTINCT t.id) as "taskCount",

    -- 工时统计
    COALESCE(SUM(t."estimateHours"), 0) as "totalEstimateHours",
    COALESCE(AVG(t."estimateHours"), 0) as "avgEstimateHours",

    -- 对话统计
    COUNT(DISTINCT c.id) as "conversationCount",

    -- 执行统计
    COUNT(DISTINCT e.id) as "executionCount",
    COUNT(DISTINCT CASE WHEN e.status = 'COMPLETED' THEN e.id END) as "completedExecutionCount"

FROM "Project" p
LEFT JOIN "User" u ON p."userId" = u.id
LEFT JOIN "Plan" pl ON p.id = pl."projectId"
LEFT JOIN "MasterPlan" mp ON p.id = mp."projectId"
LEFT JOIN "Task" t ON pl.id = t."planId"
LEFT JOIN "Conversation" c ON pl.id = c."planId"
LEFT JOIN "Execution" e ON pl.id = e."planId"
GROUP BY p.id, p.name, p."userId", u."slackUsername", p."createdAt"
ORDER BY "planCount" DESC, "taskCount" DESC;


-- =============================================
-- 9. 计划维度统计视图
-- =============================================
-- 按计划聚合任务和执行数据
CREATE VIEW "plan_statistics" AS
SELECT
    pl.id as "planId",
    pl.name as "planName",
    pl.status as "planStatus",
    pl."projectId",
    p.name as "projectName",
    p."userId",

    -- 任务统计
    COUNT(DISTINCT t.id) as "taskCount",

    -- 任务优先级统计
    COUNT(DISTINCT CASE WHEN t.priority = 1 THEN t.id END) as "priority1TaskCount",
    COUNT(DISTINCT CASE WHEN t.priority = 2 THEN t.id END) as "priority2TaskCount",
    COUNT(DISTINCT CASE WHEN t.priority = 3 THEN t.id END) as "priority3TaskCount",
    COUNT(DISTINCT CASE WHEN t.priority = 4 THEN t.id END) as "priority4TaskCount",
    COUNT(DISTINCT CASE WHEN t.priority = 5 THEN t.id END) as "priority5TaskCount",

    -- 工时统计
    COALESCE(SUM(t."estimateHours"), 0) as "totalEstimateHours",
    COALESCE(AVG(t."estimateHours"), 0) as "avgEstimateHours",

    -- 对话统计
    COUNT(DISTINCT c.id) as "conversationCount",

    -- 执行统计
    COUNT(DISTINCT e.id) as "executionCount",
    COUNT(DISTINCT CASE WHEN e.status = 'PENDING' THEN e.id END) as "pendingExecutionCount",
    COUNT(DISTINCT CASE WHEN e.status = 'RUNNING' THEN e.id END) as "runningExecutionCount",
    COUNT(DISTINCT CASE WHEN e.status = 'COMPLETED' THEN e.id END) as "completedExecutionCount",
    COUNT(DISTINCT CASE WHEN e.status = 'FAILED' THEN e.id END) as "failedExecutionCount",

    pl."createdAt",
    pl."updatedAt",
    pl."publishedAt"

FROM "Plan" pl
LEFT JOIN "Project" p ON pl."projectId" = p.id
LEFT JOIN "Task" t ON pl.id = t."planId"
LEFT JOIN "Conversation" c ON pl.id = c."planId"
LEFT JOIN "Execution" e ON pl.id = e."planId"
GROUP BY pl.id, pl.name, pl.status, pl."projectId", p.name, p."userId",
         pl."createdAt", pl."updatedAt", pl."publishedAt"
ORDER BY pl."createdAt" DESC;


-- =============================================
-- 10. 任务标签统计视图
-- =============================================
-- 统计各标签使用频率
CREATE VIEW "task_label_distribution" AS
SELECT
    label,
    COUNT(*) as "taskCount",
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM "Task" WHERE array_length(labels, 1) > 0), 2) as percentage,
    COALESCE(AVG("estimateHours"), 0) as "avgEstimateHours"
FROM "Task",
     UNNEST(labels) as label
GROUP BY label
ORDER BY "taskCount" DESC;


-- =============================================
-- 11. 时间趋势统计视图 - 每日创建数量
-- =============================================
-- 统计每日创建的计划、任务等数量趋势
CREATE VIEW "daily_creation_trend" AS
SELECT
    date_trunc('day', "createdAt") as date,
    'Plan' as entity_type,
    COUNT(*) as count
FROM "Plan"
GROUP BY date_trunc('day', "createdAt")

UNION ALL

SELECT
    date_trunc('day', "createdAt") as date,
    'Task' as entity_type,
    COUNT(*) as count
FROM "Task"
GROUP BY date_trunc('day', "createdAt")

UNION ALL

SELECT
    date_trunc('day', "createdAt") as date,
    'Project' as entity_type,
    COUNT(*) as count
FROM "Project"
GROUP BY date_trunc('day', "createdAt")

UNION ALL

SELECT
    date_trunc('day', "createdAt") as date,
    'Execution' as entity_type,
    COUNT(*) as count
FROM "Execution"
GROUP BY date_trunc('day', "createdAt")

ORDER BY date DESC, entity_type;
