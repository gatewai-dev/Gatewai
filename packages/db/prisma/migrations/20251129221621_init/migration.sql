-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('Text', 'Preview', 'File', 'Export', 'Toggle', 'Crawler', 'Resize', 'Agent', 'ThreeD', 'Painter', 'Blur', 'Compositor', 'Describer', 'Router', 'Note', 'Number', 'GPTImage1', 'LLM');

-- CreateEnum
CREATE TYPE "DataType" AS ENUM ('Text', 'Number', 'Boolean', 'Image', 'Video', 'Audio', 'File', 'Mask', 'VideoLayer', 'DesignLayer', 'Any');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'EXECUTING', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProcessEnvironment" AS ENUM ('Browser', 'Server');

-- CreateEnum
CREATE TYPE "HandleType" AS ENUM ('Input', 'Output');

-- CreateEnum
CREATE TYPE "FileAssetType" AS ENUM ('Image', 'Video');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tokens" INTEGER,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

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
    "processEnvironment" "ProcessEnvironment" NOT NULL,
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
    "userId" TEXT NOT NULL,

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
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canvasId" TEXT NOT NULL,
    "nodeId" TEXT,
    "userId" TEXT NOT NULL,
    "status" "TaskStatus",
    "durationMs" DOUBLE PRECISION,
    "finishedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "error" JSONB,
    "isTest" BOOLEAN NOT NULL DEFAULT false,

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
    "mimeType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "signedUrl" TEXT,
    "signedUrlExp" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "node_template_type_key" ON "node_template"("type");

-- CreateIndex
CREATE UNIQUE INDEX "edge_sourceHandleId_targetHandleId_key" ON "edge"("sourceHandleId", "targetHandleId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "canvas" ADD CONSTRAINT "canvas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aisession" ADD CONSTRAINT "aisession_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
