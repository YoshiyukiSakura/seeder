-- CreateEnum
CREATE TYPE "ParallelMode" AS ENUM ('SEQUENTIAL', 'PARALLEL', 'HYBRID');

-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "conflictedIssueIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hasConflicts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxParallelIssues" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "maxWorktreesPerIssue" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "parallelMode" "ParallelMode" NOT NULL DEFAULT 'SEQUENTIAL';

-- CreateIndex
CREATE INDEX "Execution_parallelMode_idx" ON "Execution"("parallelMode");
