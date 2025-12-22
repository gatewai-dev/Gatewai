/*
  Warnings:

  - You are about to drop the column `required` on the `node_template_output` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_node_template_output" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "label" TEXT,
    CONSTRAINT "node_template_output_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "node_template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_node_template_output" ("id", "label", "outputType", "templateId") SELECT "id", "label", "outputType", "templateId" FROM "node_template_output";
DROP TABLE "node_template_output";
ALTER TABLE "new_node_template_output" RENAME TO "node_template_output";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
