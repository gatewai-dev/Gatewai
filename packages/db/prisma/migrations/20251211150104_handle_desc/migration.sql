/*
  Warnings:

  - You are about to drop the column `error` on the `node` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "handle" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "node" DROP COLUMN "error";
