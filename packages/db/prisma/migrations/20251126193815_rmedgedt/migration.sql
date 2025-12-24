/*
  Warnings:

  - You are about to drop the column `dataType` on the `edge` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_edge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "sourceHandleId" TEXT NOT NULL,
    "targetHandleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "edge_source_fkey" FOREIGN KEY ("source") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "edge_target_fkey" FOREIGN KEY ("target") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "edge_sourceHandleId_fkey" FOREIGN KEY ("sourceHandleId") REFERENCES "handle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "edge_targetHandleId_fkey" FOREIGN KEY ("targetHandleId") REFERENCES "handle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_edge" ("createdAt", "id", "source", "sourceHandleId", "target", "targetHandleId", "updatedAt") SELECT "createdAt", "id", "source", "sourceHandleId", "target", "targetHandleId", "updatedAt" FROM "edge";
DROP TABLE "edge";
ALTER TABLE "new_edge" RENAME TO "edge";
CREATE UNIQUE INDEX "edge_sourceHandleId_targetHandleId_key" ON "edge"("sourceHandleId", "targetHandleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
