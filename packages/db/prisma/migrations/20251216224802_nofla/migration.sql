/*
  Warnings:

  - The values [Fal] on the enum `NodeType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NodeType_new" AS ENUM ('Text', 'Preview', 'File', 'Export', 'Toggle', 'Crop', 'Crawler', 'Resize', 'Agent', 'ThreeD', 'Paint', 'Blur', 'Compositor', 'Describer', 'Router', 'Note', 'Number', 'OpenAI_GPT_Image_1_5', 'Google_Nano_Banana_Pro', 'ImageGen', 'LLM');
ALTER TABLE "node" ALTER COLUMN "type" TYPE "NodeType_new" USING ("type"::text::"NodeType_new");
ALTER TABLE "node_template" ALTER COLUMN "type" TYPE "NodeType_new" USING ("type"::text::"NodeType_new");
ALTER TYPE "NodeType" RENAME TO "NodeType_old";
ALTER TYPE "NodeType_new" RENAME TO "NodeType";
DROP TYPE "public"."NodeType_old";
COMMIT;
