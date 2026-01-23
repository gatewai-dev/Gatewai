/*
  Warnings:

  - You are about to drop the `AgentThread` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FileAsset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `node_template` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `node_template_handle` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AgentThread" DROP CONSTRAINT "AgentThread_canvasId_fkey";

-- DropForeignKey
ALTER TABLE "handle" DROP CONSTRAINT "handle_templateHandleId_fkey";

-- DropForeignKey
ALTER TABLE "message" DROP CONSTRAINT "message_threadId_fkey";

-- DropForeignKey
ALTER TABLE "node" DROP CONSTRAINT "node_templateId_fkey";

-- DropForeignKey
ALTER TABLE "node_template_handle" DROP CONSTRAINT "node_template_handle_templateId_fkey";

-- DropTable
DROP TABLE "AgentThread";

-- DropTable
DROP TABLE "FileAsset";

-- DropTable
DROP TABLE "node_template";

-- DropTable
DROP TABLE "node_template_handle";

-- CreateTable
CREATE TABLE "nodeTemplate" (
    "id" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "tokenPrice" DOUBLE PRECISION DEFAULT 0.0,
    "variableInputs" BOOLEAN NOT NULL DEFAULT false,
    "variableInputDataTypes" "DataType"[],
    "variableOutputs" BOOLEAN NOT NULL DEFAULT false,
    "variableOutputDataTypes" "DataType"[],
    "category" TEXT,
    "subcategory" TEXT,
    "showInQuickAccess" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "defaultConfig" JSONB,
    "isTerminalNode" BOOLEAN NOT NULL DEFAULT false,
    "isTransient" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "nodeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodeTemplateHandle" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "type" "HandleType" NOT NULL,
    "dataTypes" "DataType"[],
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodeTemplateHandle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fileAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bucket" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "signedUrl" TEXT,
    "signedUrlExp" TIMESTAMP(3),
    "isUploaded" BOOLEAN NOT NULL DEFAULT true,
    "duration" INTEGER,
    "metadata" JSONB,
    "fps" INTEGER,

    CONSTRAINT "fileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentSession" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agentSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nodeTemplate_type_key" ON "nodeTemplate"("type");

-- AddForeignKey
ALTER TABLE "node" ADD CONSTRAINT "node_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "nodeTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handle" ADD CONSTRAINT "handle_templateHandleId_fkey" FOREIGN KEY ("templateHandleId") REFERENCES "nodeTemplateHandle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodeTemplateHandle" ADD CONSTRAINT "nodeTemplateHandle_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "nodeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentSession" ADD CONSTRAINT "agentSession_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "agentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
