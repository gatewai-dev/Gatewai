-- DropEnum
DROP TYPE "FileAssetType";

-- CreateTable
CREATE TABLE "agent_session" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "events" JSONB NOT NULL DEFAULT '[]',
    "lastUpdateTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "nodeId" TEXT NOT NULL,

    CONSTRAINT "agent_session_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "agent_session" ADD CONSTRAINT "agent_session_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
