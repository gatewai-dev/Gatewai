/*
  Warnings:

  - Added the required column `order` to the `node_template_handle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "node_template_handle" ADD COLUMN     "description" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL;
