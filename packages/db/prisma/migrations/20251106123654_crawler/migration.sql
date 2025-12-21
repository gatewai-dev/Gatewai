/*
  Warnings:

  - Added the required column `dataType` to the `edge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `required` to the `node_template_input` table without a default value. This is not possible if the table is not empty.
  - Added the required column `required` to the `node_template_output` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_edge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "edge_source_fkey" FOREIGN KEY ("source") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "edge_target_fkey" FOREIGN KEY ("target") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_edge" ("createdAt", "id", "source", "target", "updatedAt") SELECT "createdAt", "id", "source", "target", "updatedAt" FROM "edge";
DROP TABLE "edge";
ALTER TABLE "new_edge" RENAME TO "edge";
CREATE UNIQUE INDEX "edge_source_target_key" ON "edge"("source", "target");
CREATE TABLE "new_node_template_input" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL,
    "inputType" TEXT NOT NULL,
    CONSTRAINT "node_template_input_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "node_template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_node_template_input" ("id", "inputType", "templateId") SELECT "id", "inputType", "templateId" FROM "node_template_input";
DROP TABLE "node_template_input";
ALTER TABLE "new_node_template_input" RENAME TO "node_template_input";
CREATE TABLE "new_node_template_output" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL,
    "outputType" TEXT NOT NULL,
    CONSTRAINT "node_template_output_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "node_template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_node_template_output" ("id", "outputType", "templateId") SELECT "id", "outputType", "templateId" FROM "node_template_output";
DROP TABLE "node_template_output";
ALTER TABLE "new_node_template_output" RENAME TO "node_template_output";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
