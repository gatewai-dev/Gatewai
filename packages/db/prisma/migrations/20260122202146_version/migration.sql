-- AlterTable
ALTER TABLE "agent_session" ALTER COLUMN "model" SET DEFAULT 'gemini-3.0-flash-preview';

-- AlterTable
ALTER TABLE "canvas" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
