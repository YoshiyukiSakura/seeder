/*
  Warnings:

  - You are about to drop the column `branchName` on the `IssueExecution` table. All the data in the column will be lost.
  - You are about to drop the column `gitStatus` on the `IssueExecution` table. All the data in the column will be lost.
  - You are about to drop the column `prNumber` on the `IssueExecution` table. All the data in the column will be lost.
  - You are about to drop the column `prUrl` on the `IssueExecution` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "branchName" TEXT,
ADD COLUMN     "gitStatus" "GitOperationStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "prNumber" INTEGER,
ADD COLUMN     "prUrl" TEXT;

-- AlterTable
ALTER TABLE "IssueExecution" DROP COLUMN "branchName",
DROP COLUMN "gitStatus",
DROP COLUMN "prNumber",
DROP COLUMN "prUrl";
