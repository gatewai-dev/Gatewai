/*
  Warnings:

  - A unique constraint covering the columns `[publicAccessToken]` on the table `task` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[taskId]` on the table `task` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "task" ADD COLUMN "publicAccessToken" TEXT;
ALTER TABLE "task" ADD COLUMN "taskId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "task_publicAccessToken_key" ON "task"("publicAccessToken");

-- CreateIndex
CREATE UNIQUE INDEX "task_taskId_key" ON "task"("taskId");
