/*
  Warnings:

  - You are about to drop the `adk_session_state` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `message` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EventRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "adk_session_state" DROP CONSTRAINT "adk_session_state_canvasId_fkey";

-- DropForeignKey
ALTER TABLE "message" DROP CONSTRAINT "message_agentSessionId_fkey";

-- DropTable
DROP TABLE "adk_session_state";

-- DropTable
DROP TABLE "message";

-- DropEnum
DROP TYPE "MessageRole";

-- CreateTable
CREATE TABLE "agent_session" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "threadId" TEXT,
    "assistantId" TEXT,
    "model" TEXT DEFAULT 'gpt-4o',
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "agentSessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "role" "EventRole",
    "content" JSONB NOT NULL,
    "messageId" TEXT,
    "runId" TEXT,
    "stepId" TEXT,
    "toolCallId" TEXT,
    "toolName" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "metadata" JSONB,
    "status" "EventStatus" DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_session_threadId_key" ON "agent_session"("threadId");

-- CreateIndex
CREATE INDEX "agent_session_canvasId_idx" ON "agent_session"("canvasId");

-- CreateIndex
CREATE INDEX "agent_session_threadId_idx" ON "agent_session"("threadId");

-- CreateIndex
CREATE INDEX "event_agentSessionId_createdAt_idx" ON "event"("agentSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "event_messageId_idx" ON "event"("messageId");

-- CreateIndex
CREATE INDEX "event_runId_idx" ON "event"("runId");

-- CreateIndex
CREATE INDEX "event_eventType_idx" ON "event"("eventType");

-- AddForeignKey
ALTER TABLE "agent_session" ADD CONSTRAINT "agent_session_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_agentSessionId_fkey" FOREIGN KEY ("agentSessionId") REFERENCES "agent_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
