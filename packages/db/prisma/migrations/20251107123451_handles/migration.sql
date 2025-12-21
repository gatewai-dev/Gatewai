-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_node_template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "variableInputs" BOOLEAN NOT NULL DEFAULT false,
    "variableOutputs" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "subcategory" TEXT,
    "showInQuickAccess" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_node_template" ("createdAt", "description", "displayName", "id", "type", "updatedAt", "variableInputs", "variableOutputs") SELECT "createdAt", "description", "displayName", "id", "type", "updatedAt", "variableInputs", "variableOutputs" FROM "node_template";
DROP TABLE "node_template";
ALTER TABLE "new_node_template" RENAME TO "node_template";
CREATE UNIQUE INDEX "node_template_type_key" ON "node_template"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
