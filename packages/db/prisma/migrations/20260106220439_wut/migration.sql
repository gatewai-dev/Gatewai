-- AlterTable
ALTER TABLE "node" ADD COLUMN     "originalNodeId" TEXT;

-- AddForeignKey
ALTER TABLE "node" ADD CONSTRAINT "node_originalNodeId_fkey" FOREIGN KEY ("originalNodeId") REFERENCES "node"("id") ON DELETE SET NULL ON UPDATE CASCADE;
