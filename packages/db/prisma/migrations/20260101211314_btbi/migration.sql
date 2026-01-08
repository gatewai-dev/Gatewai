/*
  Warnings:

  - You are about to alter the column `duration` on the `FileAsset` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `size` on the `FileAsset` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "FileAsset" ALTER COLUMN "duration" SET DATA TYPE INTEGER,
ALTER COLUMN "size" SET DATA TYPE INTEGER;
