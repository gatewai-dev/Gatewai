/*
  Warnings:

  - You are about to drop the column `data` on the `node` table. All the data in the column will be lost.
  - You are about to drop the column `fileData` on the `node` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "width" REAL,
    "height" REAL,
    "draggable" BOOLEAN NOT NULL DEFAULT true,
    "selectable" BOOLEAN NOT NULL DEFAULT true,
    "deletable" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
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
INSERT INTO "new_node" ("canvasId", "createdAt", "deletable", "draggable", "height", "id", "isDirty", "name", "position", "result", "selectable", "templateId", "type", "updatedAt", "width", "zIndex") SELECT "canvasId", "createdAt", "deletable", "draggable", "height", "id", "isDirty", "name", "position", "result", "selectable", "templateId", "type", "updatedAt", "width", "zIndex" FROM "node";
DROP TABLE "node";
ALTER TABLE "new_node" RENAME TO "node";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
