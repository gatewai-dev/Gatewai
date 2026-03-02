import { prisma } from "@gatewai/db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthHonoTypes } from "../../auth.js";
import {
	getPlans,
	getUserSubscription,
	syncTokenBalance,
	updateUserSubscription,
} from "../../polar.js";

const billingRouter = new Hono<{ Variables: AuthHonoTypes }>()
	.get("/balance", async (c) => {
		const user = c.get("user");
		if (!user) return c.json({ error: "Unauthorized" }, 401);

		// Synchronize balance from Polar to local DB
		await syncTokenBalance(user.id);

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
	.get("/plans", async (c) => {
		const plans = await getPlans();
		return c.json(plans);
	})
	/**
	 * Get the user's current active subscription.
	 */
	.get("/subscription", async (c) => {
		const user = c.get("user");
		if (!user) return c.json({ error: "Unauthorized" }, 401);

		try {
			const subscription = await getUserSubscription(user.id);
			return c.json(subscription);
		} catch (error: any) {
			return c.json({ error: error.message }, 500);
		}
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

			try {
				const result = await updateUserSubscription(user.id, productId);
				return c.json({
					ok: true,
					subscriptionId: result.subscriptionId,
					productId,
					proration: result.isUpgrade ? "invoice" : "prorate",
				});
			} catch (error: any) {
				const status =
					error.message === "Invalid product ID"
						? 400
						: error.message === "No active subscription found"
							? 404
							: 500;
				return c.json({ error: error.message }, status);
			}
		},
	);

export { billingRouter };
