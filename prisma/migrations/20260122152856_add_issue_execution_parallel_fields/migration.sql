-- CreateEnum
CREATE TYPE "MergeStatus" AS ENUM ('NOT_MERGED', 'MERGING', 'MERGED', 'CONFLICT');

-- AlterTable
ALTER TABLE "IssueExecution" ADD COLUMN     "worktreePath" TEXT,
ADD COLUMN     "issueBranchName" TEXT,
ADD COLUMN     "mergeStatus" "MergeStatus" NOT NULL DEFAULT 'NOT_MERGED',
ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "claimedBy" TEXT,
ADD COLUMN     "claimLeaseAt" TIMESTAMP(3),
ADD COLUMN     "blockedByIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "IssueExecution_claimedBy_idx" ON "IssueExecution"("claimedBy");

-- CreateIndex
CREATE INDEX "IssueExecution_level_idx" ON "IssueExecution"("level");

-- CreateIndex
CREATE INDEX "IssueExecution_mergeStatus_idx" ON "IssueExecution"("mergeStatus");
