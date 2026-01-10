/*
  Warnings:

  - The values [File,Mask] on the enum `DataType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DataType_new" AS ENUM ('Text', 'Number', 'Boolean', 'Image', 'Video', 'Audio');
ALTER TABLE "handle" ALTER COLUMN "dataTypes" TYPE "DataType_new"[] USING ("dataTypes"::text::"DataType_new"[]);
ALTER TABLE "node_template_handle" ALTER COLUMN "dataTypes" TYPE "DataType_new"[] USING ("dataTypes"::text::"DataType_new"[]);
ALTER TYPE "DataType" RENAME TO "DataType_old";
ALTER TYPE "DataType_new" RENAME TO "DataType";
DROP TYPE "public"."DataType_old";
COMMIT;

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "result" JSONB;
