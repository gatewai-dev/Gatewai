/*
  Warnings:

  - The values [Toggle,Number] on the enum `NodeType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NodeType_new" AS ENUM ('Text', 'TextMerger', 'Preview', 'File', 'Export', 'Crop', 'Resize', 'Paint', 'Blur', 'Compositor', 'Note', 'Modulate', 'LLM', 'ImageGen', 'VideoGen', 'VideoGenFirstLastFrame', 'VideoGenExtend', 'VideoCompositor', 'TextToSpeech', 'SpeechToText');
ALTER TABLE "node" ALTER COLUMN "type" TYPE "NodeType_new" USING ("type"::text::"NodeType_new");
ALTER TABLE "node_template" ALTER COLUMN "type" TYPE "NodeType_new" USING ("type"::text::"NodeType_new");
ALTER TYPE "NodeType" RENAME TO "NodeType_old";
ALTER TYPE "NodeType_new" RENAME TO "NodeType";
DROP TYPE "public"."NodeType_old";
COMMIT;
