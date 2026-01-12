/*
  Warnings:

  - The values [Agent] on the enum `NodeType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `agent_session` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NodeType_new" AS ENUM ('Text', 'TextMerger', 'Preview', 'File', 'Export', 'Toggle', 'Crop', 'Resize', 'Paint', 'Blur', 'Compositor', 'Note', 'Number', 'Modulate', 'LLM', 'ImageGen', 'VideoGen', 'VideoGenFirstLastFrame', 'VideoGenExtend', 'VideoCompositor', 'TextToSpeech', 'SpeechToText');
ALTER TABLE "node" ALTER COLUMN "type" TYPE "NodeType_new" USING ("type"::text::"NodeType_new");
ALTER TABLE "node_template" ALTER COLUMN "type" TYPE "NodeType_new" USING ("type"::text::"NodeType_new");
ALTER TYPE "NodeType" RENAME TO "NodeType_old";
ALTER TYPE "NodeType_new" RENAME TO "NodeType";
DROP TYPE "public"."NodeType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "agent_session" DROP CONSTRAINT "agent_session_nodeId_fkey";

-- DropTable
DROP TABLE "agent_session";
