-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "blockedByPlanIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "masterPlanId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MasterPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterPlan_projectId_idx" ON "MasterPlan"("projectId");

-- CreateIndex
CREATE INDEX "Plan_masterPlanId_idx" ON "Plan"("masterPlanId");

-- AddForeignKey
ALTER TABLE "MasterPlan" ADD CONSTRAINT "MasterPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_masterPlanId_fkey" FOREIGN KEY ("masterPlanId") REFERENCES "MasterPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
