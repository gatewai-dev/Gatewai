/*
  Warnings:

  - The values [ThreeD] on the enum `DataType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DataType_new" AS ENUM ('Text', 'Number', 'Boolean', 'Image', 'Video', 'Audio', 'SVG', 'Lottie', 'Caption', 'Json');
ALTER TABLE "handle" ALTER COLUMN "dataTypes" TYPE "DataType_new"[] USING ("dataTypes"::text::"DataType_new"[]);
ALTER TABLE "nodeTemplate" ALTER COLUMN "variableInputDataTypes" TYPE "DataType_new"[] USING ("variableInputDataTypes"::text::"DataType_new"[]);
ALTER TABLE "nodeTemplate" ALTER COLUMN "variableOutputDataTypes" TYPE "DataType_new"[] USING ("variableOutputDataTypes"::text::"DataType_new"[]);
ALTER TABLE "nodeTemplateHandle" ALTER COLUMN "dataTypes" TYPE "DataType_new"[] USING ("dataTypes"::text::"DataType_new"[]);
ALTER TYPE "DataType" RENAME TO "DataType_old";
ALTER TYPE "DataType_new" RENAME TO "DataType";
DROP TYPE "public"."DataType_old";
COMMIT;
