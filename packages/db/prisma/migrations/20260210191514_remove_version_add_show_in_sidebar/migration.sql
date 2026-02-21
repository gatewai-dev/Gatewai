/*
  Warnings:

  - You are about to drop the column `version` on the `nodeTemplate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[type]` on the table `nodeTemplate` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "nodeTemplate_type_version_key";

-- AlterTable
ALTER TABLE "nodeTemplate" DROP COLUMN "version",
ADD COLUMN     "showInSidebar" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "nodeTemplate_type_key" ON "nodeTemplate"("type");
