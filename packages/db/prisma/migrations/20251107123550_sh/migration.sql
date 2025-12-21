/*
  Warnings:

  - A unique constraint covering the columns `[source,sourceHandle,target,targetHandle]` on the table `edge` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "edge_source_target_key";

-- AlterTable
ALTER TABLE "edge" ADD COLUMN "sourceHandle" TEXT;
ALTER TABLE "edge" ADD COLUMN "targetHandle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "edge_source_sourceHandle_target_targetHandle_key" ON "edge"("source", "sourceHandle", "target", "targetHandle");
