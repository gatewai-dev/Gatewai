-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'SUBSCRIPTION_REFILL', 'USAGE', 'REFUND', 'BONUS');

-- CreateTable
CREATE TABLE "token_transaction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "TransactionType" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_transaction_user_id_idx" ON "token_transaction"("user_id");

-- AddForeignKey
ALTER TABLE "token_transaction" ADD CONSTRAINT "token_transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
