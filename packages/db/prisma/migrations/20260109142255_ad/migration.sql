/*
  Warnings:

  - The primary key for the `agent_session` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "agent_session" DROP CONSTRAINT "agent_session_nodeId_fkey";

-- AlterTable
ALTER TABLE "agent_session" DROP CONSTRAINT "agent_session_pkey",
ALTER COLUMN "nodeId" DROP NOT NULL,
ADD CONSTRAINT "agent_session_pkey" PRIMARY KEY ("appName", "userId", "sessionId");

-- AddForeignKey
ALTER TABLE "agent_session" ADD CONSTRAINT "agent_session_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "node"("id") ON DELETE SET NULL ON UPDATE CASCADE;
