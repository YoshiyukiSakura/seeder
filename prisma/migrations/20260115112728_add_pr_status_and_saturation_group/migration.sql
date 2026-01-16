-- CreateEnum
CREATE TYPE "PRStatus" AS ENUM ('OPEN', 'APPROVED', 'CHANGES_REQ', 'MERGED', 'CLOSED');

-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "prStatus" "PRStatus",
ADD COLUMN     "prStatusSyncedAt" TIMESTAMP(3),
ADD COLUMN     "saturationGroupId" TEXT;

-- CreateIndex
CREATE INDEX "Execution_prStatus_idx" ON "Execution"("prStatus");

-- CreateIndex
CREATE INDEX "Execution_saturationGroupId_idx" ON "Execution"("saturationGroupId");
