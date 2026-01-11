/*
  Warnings:

  - You are about to drop the `aisession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "aisession" DROP CONSTRAINT "aisession_canvasId_fkey";

-- AlterTable
ALTER TABLE "canvas" ADD COLUMN     "isAPICanvas" BOOLEAN DEFAULT false;

-- DropTable
DROP TABLE "aisession";
