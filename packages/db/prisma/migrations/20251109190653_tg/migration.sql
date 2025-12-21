/*
  Warnings:

  - You are about to drop the column `processEnvironment` on the `node` table. All the data in the column will be lost.
  - Added the required column `processEnvironment` to the `node_template` table without a default value. This is not possible if the table is not empty.

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
    "fileData" JSONB,
    "data" JSONB,
    "isDirty" BOOLEAN NOT NULL DEFAULT false,
    "result" JSONB,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "zIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "canvasId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "node_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "node_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "node_template" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_node" ("canvasId", "createdAt", "data", "deletable", "draggable", "fileData", "height", "id", "isDirty", "name", "position", "result", "selectable", "templateId", "type", "updatedAt", "visible", "width", "zIndex") SELECT "canvasId", "createdAt", "data", "deletable", "draggable", "fileData", "height", "id", "isDirty", "name", "position", "result", "selectable", "templateId", "type", "updatedAt", "visible", "width", "zIndex" FROM "node";
DROP TABLE "node";
ALTER TABLE "new_node" RENAME TO "node";
CREATE TABLE "new_node_template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "processEnvironment" TEXT NOT NULL,
    "variableInputs" BOOLEAN NOT NULL DEFAULT false,
    "variableOutputs" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "subcategory" TEXT,
    "showInQuickAccess" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_node_template" ("category", "createdAt", "description", "displayName", "id", "showInQuickAccess", "subcategory", "type", "updatedAt", "variableInputs", "variableOutputs") SELECT "category", "createdAt", "description", "displayName", "id", "showInQuickAccess", "subcategory", "type", "updatedAt", "variableInputs", "variableOutputs" FROM "node_template";
DROP TABLE "node_template";
ALTER TABLE "new_node_template" RENAME TO "node_template";
CREATE UNIQUE INDEX "node_template_type_key" ON "node_template"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
