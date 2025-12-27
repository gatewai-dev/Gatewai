/*
  Warnings:

  - You are about to drop the column `processEnvironment` on the `node_template` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "NodeType" ADD VALUE 'RemoteAgent';

-- AlterTable
ALTER TABLE "node_template" DROP COLUMN "processEnvironment";

-- DropEnum
DROP TYPE "ProcessEnvironment";
