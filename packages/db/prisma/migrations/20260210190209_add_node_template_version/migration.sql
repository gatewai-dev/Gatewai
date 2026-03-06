/*
  Warnings:

  - A unique constraint covering the columns `[type,version]` on the table `nodeTemplate` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "nodeTemplate_type_key";

-- AlterTable
ALTER TABLE "nodeTemplate" ADD COLUMN     "version" TEXT NOT NULL DEFAULT '0.0.0';

-- CreateIndex
CREATE UNIQUE INDEX "nodeTemplate_type_version_key" ON "nodeTemplate"("type", "version");
