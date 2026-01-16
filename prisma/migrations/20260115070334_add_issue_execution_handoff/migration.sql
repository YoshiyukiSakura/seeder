/*
  Warnings:

  - You are about to drop the column `linearIssueId` on the `IssueExecution` table. All the data in the column will be lost.
  - You are about to drop the column `linearProjectId` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `linearIssueId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `linearToken` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "IssueExecution" DROP COLUMN "linearIssueId",
ADD COLUMN     "handoff" JSONB;

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "linearProjectId";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "linearIssueId";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "linearToken";
