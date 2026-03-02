import { prisma } from "@gatewai/db";
import { zValidator } from "@hono/zod-validator";
import { SubscriptionProrationBehavior } from "@polar-sh/sdk/models/components/subscriptionprorationbehavior.js";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthHonoTypes } from "../../auth.js";
import { polarClient } from "../../auth.js";

// Tier index — higher = higher tier; must mirror the frontend constants
const PLAN_TIER: Record<string, number> = {
	"608a6922-2db6-4b97-b1f3-bbcf4765e75e": 0, // Basic
	"b9fb573b-23e3-4ee7-adfc-778efc753e69": 1, // Pro
	"ca6587d9-00f9-48b6-91aa-50b8c6a2a47b": 2, // Max
};

const billingRouter = new Hono<{ Variables: AuthHonoTypes }>()
	.get("/balance", async (c) => {
		const user = c.get("user");
		if (!user) return c.json({ error: "Unauthorized" }, 401);

		const dbUser = await prisma.user.findUnique({
			where: { id: user.id },
			select: { tokens: true },
		});

		return c.json({ tokens: dbUser?.tokens ?? 0 });
	})
	.get("/usage", async (c) => {
		const user = c.get("user");
		if (!user) return c.json({ error: "Unauthorized" }, 401);

		const month = new Date().toISOString().slice(0, 7);
		const usage = await prisma.usageRecord.findUnique({
			where: {
				userId_month: {
					userId: user.id,
					month,
				},
			},
		});

		return c.json(
			usage ?? {
				tasksUsed: 0,
				tokensUsed: 0,
				storageUsed: 0,
				apiCallsUsed: 0,
			},
		);
	})
	/**
	 * Get the list of available pricing plans.
	 */
	.get("/plans", (c) => {
		const plans = [
			{
				id: "608a6922-2db6-4b97-b1f3-bbcf4765e75e",
				name: "Basic",
				price: 9,
				tokens: 1000,
				features: [
					"1,000 tokens / month",
					"Standard support",
					"Community access",
				],
			},
			{
				id: "b9fb573b-23e3-4ee7-adfc-778efc753e69",
				name: "Pro",
				price: 29,
				tokens: 5000,
				features: [
					"5,000 tokens / month",
					"Priority support",
					"Advanced features",
					"Premium support",
				],
			},
			{
				id: "ca6587d9-00f9-48b6-91aa-50b8c6a2a47b",
				name: "Max",
				price: 99,
				tokens: 20000,
				features: [
					"20,000 tokens / month",
					"24/7 dedicated support",
					"Custom solutions",
					"Highest priority queue",
					"Dedicated account manager",
				],
			},
		];
		return c.json(plans);
	})
	/**
	 * Get the user's current active subscription.
	 */
	.get("/subscription", async (c) => {
		const user = c.get("user");
		if (!user) return c.json({ error: "Unauthorized" }, 401);

		const subsResult = await polarClient.subscriptions.list({
			externalCustomerId: user.id,
			active: true,
			limit: 1,
		});

		const subscription = subsResult.result?.items?.[0] ?? null;
		return c.json(subscription);
	})
	/**
	 * Update (upgrade/downgrade) the user's active Polar subscription.
	 * - Upgrade → prorationBehavior: "invoice"  (charge prorated diff immediately)
	 * - Downgrade → prorationBehavior: "prorate" (credit applied on next invoice)
	 */
	.post(
		"/subscription/update",
		zValidator("json", z.object({ productId: z.string().uuid() })),
		async (c) => {
			const user = c.get("user");
			if (!user) return c.json({ error: "Unauthorized" }, 401);

			const { productId } = c.req.valid("json");

			if (!(productId in PLAN_TIER)) {
				return c.json({ error: "Invalid product ID" }, 400);
			}

			// 1. Fetch the user's active subscriptions using their externalCustomerId (= our userId)
			const subsResult = await polarClient.subscriptions.list({
				externalCustomerId: user.id,
				active: true,
				limit: 10,
			});

			const subscriptions = subsResult.result?.items ?? [];
			if (!subscriptions.length) {
				return c.json({ error: "No active subscription found" }, 404);
			}

			// Pick the highest-tier active subscription to update
			const currentSub = [...subscriptions].sort((a, b) => {
				const ta = PLAN_TIER[a.productId] ?? -1;
				const tb = PLAN_TIER[b.productId] ?? -1;
				return tb - ta;
			})[0];

			const currentTier = PLAN_TIER[currentSub.productId] ?? -1;
			const targetTier = PLAN_TIER[productId] ?? -1;
			const isUpgrade = targetTier > currentTier;

			// 2. Update subscription with the correct proration behavior
			await polarClient.subscriptions.update({
				id: currentSub.id,
				subscriptionUpdate: {
					productId,
					prorationBehavior: isUpgrade
						? SubscriptionProrationBehavior.Invoice // immediate charge for upgrade
						: SubscriptionProrationBehavior.Prorate, // next billing cycle for downgrade
				},
			});

			return c.json({
				ok: true,
				subscriptionId: currentSub.id,
				productId,
				proration: isUpgrade ? "invoice" : "prorate",
			});
		},
	);

export { billingRouter };
