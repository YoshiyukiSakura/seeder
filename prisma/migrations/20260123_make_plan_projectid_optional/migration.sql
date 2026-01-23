-- Make Plan.projectId optional to support orphan plans (conversations without a project)
ALTER TABLE "Plan" ALTER COLUMN "projectId" DROP NOT NULL;
