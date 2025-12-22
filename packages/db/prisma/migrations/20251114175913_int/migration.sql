-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "tokens" INTEGER
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME,
    "updatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "width" REAL,
    "height" REAL,
    "draggable" BOOLEAN NOT NULL DEFAULT true,
    "selectable" BOOLEAN NOT NULL DEFAULT true,
    "deletable" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "isDirty" BOOLEAN NOT NULL DEFAULT false,
    "result" JSONB,
    "zIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "canvasId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "node_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "node_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "node_template" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "node_template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "processEnvironment" TEXT NOT NULL,
    "tokenPrice" REAL DEFAULT 0.0,
    "variableInputs" BOOLEAN NOT NULL DEFAULT false,
    "variableOutputs" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "subcategory" TEXT,
    "showInQuickAccess" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "defaultConfig" JSONB
);

-- CreateTable
CREATE TABLE "node_template_input" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL,
    "inputType" TEXT NOT NULL,
    "label" TEXT,
    CONSTRAINT "node_template_input_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "node_template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "node_template_output" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "label" TEXT,
    CONSTRAINT "node_template_output_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "node_template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "edge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "sourceHandle" TEXT,
    "targetHandle" TEXT,
    "dataType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "edge_source_fkey" FOREIGN KEY ("source") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "edge_target_fkey" FOREIGN KEY ("target") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "canvas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "canvas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "aisession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messages" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "canvasId" TEXT NOT NULL,
    CONSTRAINT "aisession_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "canvasId" TEXT NOT NULL,
    "nodeId" TEXT,
    "userId" TEXT NOT NULL,
    "publicAccessToken" TEXT,
    "taskId" TEXT,
    CONSTRAINT "task_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "node" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "node_template_type_key" ON "node_template"("type");

-- CreateIndex
CREATE UNIQUE INDEX "edge_source_sourceHandle_target_targetHandle_key" ON "edge"("source", "sourceHandle", "target", "targetHandle");

-- CreateIndex
CREATE UNIQUE INDEX "task_publicAccessToken_key" ON "task"("publicAccessToken");

-- CreateIndex
CREATE UNIQUE INDEX "task_taskId_key" ON "task"("taskId");
