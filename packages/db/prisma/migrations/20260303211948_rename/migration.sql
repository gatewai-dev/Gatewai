/*
  Warnings:

  - You are about to drop the column `tokenPrice` on the `nodeTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `lemon_squeezy_customer_id` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `pricing_plan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `token_purchase` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_pricing_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_user_id_fkey";

-- AlterTable
ALTER TABLE "nodeTemplate" DROP COLUMN "tokenPrice";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "lemon_squeezy_customer_id";

-- DropTable
DROP TABLE "pricing_plan";

-- DropTable
DROP TABLE "subscription";

-- DropTable
DROP TABLE "token_purchase";

-- DropEnum
DROP TYPE "BillingInterval";

-- DropEnum
DROP TYPE "PurchaseStatus";
