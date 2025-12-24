/*
  Warnings:

  - Added the required column `mimeType` to the `FileAsset` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FileAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bucket" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "signedUrl" TEXT,
    "signedUrlExp" DATETIME,
    "userId" TEXT NOT NULL,
    CONSTRAINT "FileAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FileAsset" ("bucket", "createdAt", "height", "id", "key", "name", "signedUrl", "signedUrlExp", "updatedAt", "userId", "width") SELECT "bucket", "createdAt", "height", "id", "key", "name", "signedUrl", "signedUrlExp", "updatedAt", "userId", "width" FROM "FileAsset";
DROP TABLE "FileAsset";
ALTER TABLE "new_FileAsset" RENAME TO "FileAsset";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
