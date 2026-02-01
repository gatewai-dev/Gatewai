/*
  Warnings:

  - You are about to drop the `canvas_share` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "canvas_share" DROP CONSTRAINT "canvas_share_canvasId_fkey";

-- DropForeignKey
ALTER TABLE "canvas_share" DROP CONSTRAINT "canvas_share_userId_fkey";

-- DropTable
DROP TABLE "canvas_share";

-- DropEnum
DROP TYPE "ShareRole";
