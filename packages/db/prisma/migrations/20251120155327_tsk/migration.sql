/*
  Warnings:

  - You are about to drop the column `baseCostInCents` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `batchId` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `costInCents` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `delayedUntil` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `idempotencyKey` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `number` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `publicAccessToken` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `queuedAt` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `taskId` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `ttl` on the `task` table. All the data in the column will be lost.

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
    "payload" JSONB,
    "output" JSONB,
    "status" TEXT,
    "durationMs" REAL NOT NULL,
    "finishedAt" DATETIME,
    "expiredAt" DATETIME,
    "startedAt" DATETIME,
    "error" JSONB,
    "isTest" BOOLEAN NOT NULL,
    CONSTRAINT "task_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "node" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_task" ("canvasId", "createdAt", "durationMs", "error", "expiredAt", "finishedAt", "id", "isTest", "name", "nodeId", "output", "payload", "startedAt", "status", "updatedAt", "userId") SELECT "canvasId", "createdAt", "durationMs", "error", "expiredAt", "finishedAt", "id", "isTest", "name", "nodeId", "output", "payload", "startedAt", "status", "updatedAt", "userId" FROM "task";
DROP TABLE "task";
ALTER TABLE "new_task" RENAME TO "task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
