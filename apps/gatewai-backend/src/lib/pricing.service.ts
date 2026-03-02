import type { IPricingService } from '@gatewai/core';
import { logger } from "@gatewai/core";
import { TOKENS } from "@gatewai/core/di";
import type { PrismaClient } from "@gatewai/db";
import { inject, injectable } from "inversify";

@injectable()
export class PricingService implements IPricingService {
    constructor(
        @inject(TOKENS.PRISMA) private prisma: PrismaClient,
    ) { }

    async canAfford(userId: string, price: number): Promise<boolean> {
        if (price <= 0) return true;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { tokens: true },
        });

        return (user?.tokens ?? 0) >= price;
    }

    async deductTokens(userId: string, price: number, taskId: string): Promise<void> {
        if (price <= 0) return;

        await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id: userId },
                data: { tokens: { decrement: price } },
            });

            if (user.tokens < 0) {
                throw new Error(`Insufficient tokens for user ${userId}. Remaining: ${user.tokens + price}, Required: ${price}`);
            }

            await tx.tokenTransaction.create({
                data: {
                    userId,
                    amount: -price,
                    type: "USAGE",
                    metadata: { taskId },
                },
            });

            // Report usage to Polar Benefit Metrics
            try {
                const { ingestUsageEvent } = await import("../polar.js");
                await ingestUsageEvent(userId, price);
            } catch (err) {
                logger.error(`Failed to report usage to Polar for user ${userId}:`, err);
            }

            logger.info(`Deducted ${price} tokens from user ${userId} for task ${taskId}`);
        });
    }

    async creditTokens(userId: string, amount: number, type: "PURCHASE" | "SUBSCRIPTION_REFILL" | "BONUS" | "REFUND", metadata?: any): Promise<void> {
        if (amount <= 0) return;

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { tokens: { increment: amount } },
            });

            await tx.tokenTransaction.create({
                data: {
                    userId,
                    amount,
                    type,
                    metadata,
                },
            });

            logger.info(`Credited ${amount} tokens to user ${userId} (${type})`);
        });
    }

    async trackUsage(userId: string, type: 'tasksUsed' | 'tokensUsed' | 'apiCallsUsed', amount: number): Promise<void> {
        const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"

        await this.prisma.usageRecord.upsert({
            where: {
                userId_month: {
                    userId,
                    month,
                },
            },
            update: {
                [type]: { increment: amount },
            },
            create: {
                userId,
                month,
                [type]: amount,
            },
        });
    }
}

