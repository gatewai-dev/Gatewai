-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('Text', 'Preview', 'File', 'Export', 'Toggle', 'Crop', 'Resize', 'Agent', 'Paint', 'Blur', 'Compositor', 'Note', 'Number', 'Modulate', 'LLM', 'ImageGen', 'VideoGen', 'VideoGenFirstLastFrame', 'VideoGenExtend', 'VideoCompositor', 'TextToSpeech', 'SpeechToText');

-- CreateEnum
CREATE TYPE "DataType" AS ENUM ('Text', 'Number', 'Boolean', 'Image', 'Video', 'Audio', 'File', 'Mask');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'EXECUTING', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "HandleType" AS ENUM ('Input', 'Output');

-- CreateEnum
CREATE TYPE "FileAssetType" AS ENUM ('Image', 'Video');

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
CREATE TABLE "node_template" (
    "id" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "tokenPrice" DOUBLE PRECISION DEFAULT 0.0,
    "variableInputs" BOOLEAN NOT NULL DEFAULT false,
    "variableOutputs" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "subcategory" TEXT,
    "showInQuickAccess" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "defaultConfig" JSONB,
    "isTerminalNode" BOOLEAN NOT NULL DEFAULT false,
    "isTransient" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "node_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_template_handle" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "type" "HandleType" NOT NULL,
    "dataTypes" "DataType"[],
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_template_handle_pkey" PRIMARY KEY ("id")
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aisession" (
    "id" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canvasId" TEXT NOT NULL,

    CONSTRAINT "aisession_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
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

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "node_template_type_key" ON "node_template"("type");

-- CreateIndex
CREATE UNIQUE INDEX "edge_sourceHandleId_targetHandleId_key" ON "edge"("sourceHandleId", "targetHandleId");

-- AddForeignKey
ALTER TABLE "node" ADD CONSTRAINT "node_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node" ADD CONSTRAINT "node_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "node_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handle" ADD CONSTRAINT "handle_templateHandleId_fkey" FOREIGN KEY ("templateHandleId") REFERENCES "node_template_handle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handle" ADD CONSTRAINT "handle_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_template_handle" ADD CONSTRAINT "node_template_handle_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "node_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edge" ADD CONSTRAINT "edge_source_fkey" FOREIGN KEY ("source") REFERENCES "node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edge" ADD CONSTRAINT "edge_target_fkey" FOREIGN KEY ("target") REFERENCES "node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edge" ADD CONSTRAINT "edge_sourceHandleId_fkey" FOREIGN KEY ("sourceHandleId") REFERENCES "handle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edge" ADD CONSTRAINT "edge_targetHandleId_fkey" FOREIGN KEY ("targetHandleId") REFERENCES "handle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aisession" ADD CONSTRAINT "aisession_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taskBatch" ADD CONSTRAINT "taskBatch_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "taskBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
