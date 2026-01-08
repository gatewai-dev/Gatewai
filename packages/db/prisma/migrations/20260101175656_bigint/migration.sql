/*
  Warnings:

  - You are about to alter the column `duration` on the `FileAsset` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `BigInt`.
  - You are about to alter the column `size` on the `FileAsset` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `BigInt`.
  - Made the column `duration` on table `FileAsset` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "FileAsset" ALTER COLUMN "duration" SET NOT NULL,
ALTER COLUMN "duration" SET DATA TYPE BIGINT,
ALTER COLUMN "size" SET DATA TYPE BIGINT;
