/*
  Warnings:

  - You are about to drop the column `deletable` on the `node` table. All the data in the column will be lost.
  - You are about to drop the column `draggable` on the `node` table. All the data in the column will be lost.
  - You are about to drop the column `selectable` on the `node` table. All the data in the column will be lost.
  - Added the required column `userId` to the `canvas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `fileAsset` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ShareRole" AS ENUM ('VIEWER', 'EDITOR');

-- AlterTable
ALTER TABLE "agent_session" ALTER COLUMN "model" DROP DEFAULT;

-- AlterTable
ALTER TABLE "canvas" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "fileAsset" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "node" DROP COLUMN "deletable",
DROP COLUMN "draggable",
DROP COLUMN "selectable";

-- CreateTable
CREATE TABLE "canvas_share" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ShareRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canvas_share_userId_idx" ON "canvas_share"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "canvas_share_canvasId_userId_key" ON "canvas_share"("canvasId", "userId");

-- CreateIndex
CREATE INDEX "canvas_userId_idx" ON "canvas"("userId");

-- CreateIndex
CREATE INDEX "fileAsset_userId_idx" ON "fileAsset"("userId");

-- AddForeignKey
ALTER TABLE "canvas" ADD CONSTRAINT "canvas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fileAsset" ADD CONSTRAINT "fileAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_share" ADD CONSTRAINT "canvas_share_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_share" ADD CONSTRAINT "canvas_share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
