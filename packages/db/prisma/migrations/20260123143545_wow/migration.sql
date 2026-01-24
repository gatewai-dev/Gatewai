-- CreateEnum
CREATE TYPE "PatchStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "canvas_patch" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "patch" JSONB NOT NULL,
    "status" "PatchStatus" NOT NULL DEFAULT 'PENDING',
    "agentSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_patch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "canvas_patch" ADD CONSTRAINT "canvas_patch_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_patch" ADD CONSTRAINT "canvas_patch_agentSessionId_fkey" FOREIGN KEY ("agentSessionId") REFERENCES "agent_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
