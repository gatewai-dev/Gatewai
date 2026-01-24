-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('Text', 'TextMerger', 'Preview', 'File', 'Export', 'Crop', 'Resize', 'Paint', 'Blur', 'Compositor', 'Note', 'Modulate', 'LLM', 'ImageGen', 'VideoGen', 'VideoGenFirstLastFrame', 'VideoGenExtend', 'VideoCompositor', 'TextToSpeech', 'SpeechToText');

-- CreateEnum
CREATE TYPE "DataType" AS ENUM ('Text', 'Number', 'Boolean', 'Image', 'Video', 'Audio');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'EXECUTING', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "HandleType" AS ENUM ('Input', 'Output');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'MODEL', 'SYSTEM', 'TOOL');

-- CreateTable
CREATE TABLE "node" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "position" JSONB NOT NULL,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "draggable" BOOLEAN NOT NULL DEFAULT true,
    "selectable" BOOLEAN NOT NULL DEFAULT true,
    "deletable" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "isDirty" BOOLEAN NOT NULL DEFAULT false,
    "result" JSONB,
    "zIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canvasId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "originalNodeId" TEXT,

    CONSTRAINT "node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handle" (
    "id" TEXT NOT NULL,
    "type" "HandleType" NOT NULL,
    "dataTypes" "DataType"[],
    "label" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "templateHandleId" TEXT,
    "nodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handle_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "edge" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "sourceHandleId" TEXT NOT NULL,
    "targetHandleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isAPICanvas" BOOLEAN DEFAULT false,
    "originalCanvasId" TEXT,

    CONSTRAINT "canvas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taskBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canvasId" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "taskBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nodeId" TEXT,
    "status" "TaskStatus",
    "durationMs" DOUBLE PRECISION,
    "finishedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "error" JSONB,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "batchId" TEXT NOT NULL,
    "result" JSONB,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "adk_session_state" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adk_session_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nodeTemplate_type_key" ON "nodeTemplate"("type");

-- CreateIndex
CREATE UNIQUE INDEX "edge_sourceHandleId_targetHandleId_key" ON "edge"("sourceHandleId", "targetHandleId");

-- AddForeignKey
ALTER TABLE "node" ADD CONSTRAINT "node_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node" ADD CONSTRAINT "node_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "nodeTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node" ADD CONSTRAINT "node_originalNodeId_fkey" FOREIGN KEY ("originalNodeId") REFERENCES "node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handle" ADD CONSTRAINT "handle_templateHandleId_fkey" FOREIGN KEY ("templateHandleId") REFERENCES "nodeTemplateHandle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handle" ADD CONSTRAINT "handle_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodeTemplateHandle" ADD CONSTRAINT "nodeTemplateHandle_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "nodeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edge" ADD CONSTRAINT "edge_source_fkey" FOREIGN KEY ("source") REFERENCES "node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edge" ADD CONSTRAINT "edge_target_fkey" FOREIGN KEY ("target") REFERENCES "node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edge" ADD CONSTRAINT "edge_sourceHandleId_fkey" FOREIGN KEY ("sourceHandleId") REFERENCES "handle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edge" ADD CONSTRAINT "edge_targetHandleId_fkey" FOREIGN KEY ("targetHandleId") REFERENCES "handle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas" ADD CONSTRAINT "canvas_originalCanvasId_fkey" FOREIGN KEY ("originalCanvasId") REFERENCES "canvas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taskBatch" ADD CONSTRAINT "taskBatch_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "taskBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adk_session_state" ADD CONSTRAINT "adk_session_state_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "adk_session_state"("id") ON DELETE CASCADE ON UPDATE CASCADE;
