/*
  Warnings:

  - You are about to drop the column `description` on the `task` table. All the data in the column will be lost.
  - Added the required column `baseCostInCents` to the `task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `costInCents` to the `task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `durationMs` to the `task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isTest` to the `task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `number` to the `task` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "canvasId" TEXT NOT NULL,
    "nodeId" TEXT,
    "userId" TEXT NOT NULL,
    "publicAccessToken" TEXT,
    "taskId" TEXT,
    "batchId" TEXT,
    "payload" JSONB,
    "output" JSONB,
    "number" REAL NOT NULL,
    "status" TEXT,
    "durationMs" REAL NOT NULL,
    "costInCents" REAL NOT NULL,
    "baseCostInCents" REAL NOT NULL,
    "tags" JSONB,
    "idempotencyKey" TEXT,
    "ttl" TEXT,
    "expiredAt" DATETIME,
    "finishedAt" DATETIME,
    "startedAt" DATETIME,
    "delayedUntil" DATETIME,
    "queuedAt" DATETIME,
    "metadata" JSONB,
    "error" JSONB,
    "isTest" BOOLEAN NOT NULL,
    CONSTRAINT "task_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "node" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_task" ("canvasId", "createdAt", "id", "name", "nodeId", "publicAccessToken", "status", "taskId", "updatedAt", "userId") SELECT "canvasId", "createdAt", "id", "name", "nodeId", "publicAccessToken", "status", "taskId", "updatedAt", "userId" FROM "task";
DROP TABLE "task";
ALTER TABLE "new_task" RENAME TO "task";
CREATE UNIQUE INDEX "task_publicAccessToken_key" ON "task"("publicAccessToken");
CREATE UNIQUE INDEX "task_taskId_key" ON "task"("taskId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
