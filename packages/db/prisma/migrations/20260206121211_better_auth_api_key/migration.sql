/*
  Warnings:

  - You are about to drop the `api_key` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "api_key" DROP CONSTRAINT "api_key_userId_fkey";

-- DropTable
DROP TABLE "api_key";

-- CreateTable
CREATE TABLE "apikey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT NOT NULL,
    "start" TEXT,
    "prefix" TEXT,
    "permissions" JSONB,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apikey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apikey_key_key" ON "apikey"("key");

-- CreateIndex
CREATE INDEX "apikey_userId_idx" ON "apikey"("userId");

-- AddForeignKey
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
