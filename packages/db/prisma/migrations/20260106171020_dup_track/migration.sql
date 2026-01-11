-- AlterTable
ALTER TABLE "canvas" ADD COLUMN     "originalCanvasId" TEXT;

-- AddForeignKey
ALTER TABLE "canvas" ADD CONSTRAINT "canvas_originalCanvasId_fkey" FOREIGN KEY ("originalCanvasId") REFERENCES "canvas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
