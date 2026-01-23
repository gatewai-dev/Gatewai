/*
  Warnings:

  - You are about to drop the column `threadId` on the `message` table. All the data in the column will be lost.
  - Added the required column `agentSessionId` to the `message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "message" DROP CONSTRAINT "message_threadId_fkey";

-- AlterTable
ALTER TABLE "message" DROP COLUMN "threadId",
ADD COLUMN     "agentSessionId" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "content" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "message_agentSessionId_idx" ON "message"("agentSessionId");

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_agentSessionId_fkey" FOREIGN KEY ("agentSessionId") REFERENCES "adk_session_state"("id") ON DELETE CASCADE ON UPDATE CASCADE;
