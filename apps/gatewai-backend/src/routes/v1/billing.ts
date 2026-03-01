import { prisma } from "@gatewai/db";
import { Hono } from "hono";
import type { AuthHonoTypes } from "../../auth.js";

const billingRouter = new Hono<{ Variables: AuthHonoTypes }>().get(
	"/usage",
	async (c) => {
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
	},
);

export { billingRouter };
