-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IssueExecutionStatus" AS ENUM ('PENDING', 'WAITING_DEPS', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "GitOperationStatus" AS ENUM ('NOT_STARTED', 'BRANCH_CREATED', 'COMMITTED', 'PUSHED', 'PR_CREATED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "LogSource" AS ENUM ('SYSTEM', 'CLAUDE', 'GIT', 'FRONTEND', 'API');

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "config" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueExecution" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "linearIssueId" TEXT,
    "taskTitle" TEXT NOT NULL,
    "taskDescription" TEXT NOT NULL,
    "status" "IssueExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "gitStatus" "GitOperationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "branchName" TEXT,
    "prUrl" TEXT,
    "prNumber" INTEGER,
    "claudeSessionId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "issueExecutionId" TEXT,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "source" "LogSource" NOT NULL DEFAULT 'SYSTEM',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLock" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Execution_planId_idx" ON "Execution"("planId");

-- CreateIndex
CREATE INDEX "Execution_status_idx" ON "Execution"("status");

-- CreateIndex
CREATE INDEX "Execution_createdAt_idx" ON "Execution"("createdAt");

-- CreateIndex
CREATE INDEX "IssueExecution_executionId_idx" ON "IssueExecution"("executionId");

-- CreateIndex
CREATE INDEX "IssueExecution_taskId_idx" ON "IssueExecution"("taskId");

-- CreateIndex
CREATE INDEX "IssueExecution_status_idx" ON "IssueExecution"("status");

-- CreateIndex
CREATE INDEX "ExecutionLog_executionId_idx" ON "ExecutionLog"("executionId");

-- CreateIndex
CREATE INDEX "ExecutionLog_issueExecutionId_idx" ON "ExecutionLog"("issueExecutionId");

-- CreateIndex
CREATE INDEX "ExecutionLog_timestamp_idx" ON "ExecutionLog"("timestamp");

-- CreateIndex
CREATE INDEX "ExecutionLog_level_idx" ON "ExecutionLog"("level");

-- CreateIndex
CREATE INDEX "ExecutionLog_source_idx" ON "ExecutionLog"("source");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLock_projectId_key" ON "ProjectLock"("projectId");

-- CreateIndex
CREATE INDEX "ProjectLock_projectId_idx" ON "ProjectLock"("projectId");

-- CreateIndex
CREATE INDEX "ProjectLock_expiresAt_idx" ON "ProjectLock"("expiresAt");

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueExecution" ADD CONSTRAINT "IssueExecution_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueExecution" ADD CONSTRAINT "IssueExecution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_issueExecutionId_fkey" FOREIGN KEY ("issueExecutionId") REFERENCES "IssueExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLock" ADD CONSTRAINT "ProjectLock_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
