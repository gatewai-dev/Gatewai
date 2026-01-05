/*
  Warnings:

  - You are about to drop the column `userId` on the `FileAsset` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `canvas` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `taskBatch` table. All the data in the column will be lost.
  - You are about to drop the `account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FileAsset" DROP CONSTRAINT "FileAsset_userId_fkey";

-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";

-- DropForeignKey
ALTER TABLE "canvas" DROP CONSTRAINT "canvas_userId_fkey";

-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_userId_fkey";

-- DropForeignKey
ALTER TABLE "taskBatch" DROP CONSTRAINT "taskBatch_userId_fkey";

-- AlterTable
ALTER TABLE "FileAsset" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "canvas" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "taskBatch" DROP COLUMN "userId";

-- DropTable
DROP TABLE "account";

-- DropTable
DROP TABLE "session";

-- DropTable
DROP TABLE "user";

-- DropTable
DROP TABLE "verification";
