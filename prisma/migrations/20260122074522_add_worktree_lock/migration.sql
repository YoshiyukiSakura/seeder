-- CreateTable
CREATE TABLE "WorktreeLock" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "worktreePath" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorktreeLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorktreeLock_executionId_key" ON "WorktreeLock"("executionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorktreeLock_worktreePath_key" ON "WorktreeLock"("worktreePath");

-- CreateIndex
CREATE INDEX "WorktreeLock_projectId_idx" ON "WorktreeLock"("projectId");

-- CreateIndex
CREATE INDEX "WorktreeLock_expiresAt_idx" ON "WorktreeLock"("expiresAt");
