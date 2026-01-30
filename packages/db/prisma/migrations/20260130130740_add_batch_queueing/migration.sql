-- AlterTable
ALTER TABLE "taskBatch" ADD COLUMN     "pendingJobData" JSONB,
ADD COLUMN     "startedAt" TIMESTAMP(3);
