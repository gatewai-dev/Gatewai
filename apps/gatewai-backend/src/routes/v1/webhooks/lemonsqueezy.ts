import crypto from "node:crypto";
import { logger } from "@gatewai/core";
import { prisma } from "@gatewai/db";
import { Hono } from "hono";

// Helper to verify LemonSqueezy signature
const verifySignature = (
	rawBody: string,
	signature: string,
	secret: string,
) => {
	const hmac = crypto.createHmac("sha256", secret);
	const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
	const signatureBuffer = Buffer.from(signature, "utf8");
	return crypto.timingSafeEqual(digest, signatureBuffer);
};

const lemonsqueezyRouter = new Hono().post("/webhook", async (c) => {
	const rawBody = await c.req.text();
	const signature = c.req.header("x-signature");
	const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;

	if (secret && signature && !verifySignature(rawBody, signature, secret)) {
		logger.error("Invalid LemonSqueezy signature");
		return c.json({ error: "Invalid signature" }, 401);
	}

	const body = JSON.parse(rawBody);
	const eventName = body.meta.event_name;
	const data = body.data;

	logger.info(`Received LemonSqueezy webhook: ${eventName}`);

	// Log the event
	await prisma.webhookEvent.create({
		data: {
			eventName,
			body: body as any,
		},
	});

	try {
		switch (eventName) {
			case "subscription_created":
			case "subscription_updated": {
				const attributes = data.attributes;
				const userId = body.meta.custom_data?.user_id || attributes.user_id; // Adjust based on how you pass custom data

				if (!userId) {
					logger.error("No user_id found in LemonSqueezy webhook");
					break;
				}

				await prisma.subscription.upsert({
					where: { lemonSqueezyId: data.id.toString() },
					update: {
						status: attributes.status,
						statusFormatted: attributes.status_formatted,
						renewsAt: attributes.renews_at
							? new Date(attributes.renews_at)
							: null,
						endsAt: attributes.ends_at ? new Date(attributes.ends_at) : null,
						trialEndsAt: attributes.trial_ends_at
							? new Date(attributes.trial_ends_at)
							: null,
						price: attributes.unit_price_formatted,
						isPaused: attributes.pause !== null,
						updatedAt: new Date(),
					},
					create: {
						lemonSqueezyId: data.id.toString(),
						orderId: attributes.order_id,
						name: attributes.product_name,
						email: attributes.user_email,
						status: attributes.status,
						statusFormatted: attributes.status_formatted,
						renewsAt: attributes.renews_at
							? new Date(attributes.renews_at)
							: null,
						endsAt: attributes.ends_at ? new Date(attributes.ends_at) : null,
						trialEndsAt: attributes.trial_ends_at
							? new Date(attributes.trial_ends_at)
							: null,
						price: attributes.unit_price_formatted,
						subscriptionItemId: attributes.first_subscription_item.id,
						userId: userId,
					},
				});
				break;
			}
			case "order_created": {
				// Handle one-time token purchases
				const attributes = data.attributes;
				const userId = body.meta.custom_data?.user_id;

				if (userId && attributes.status === "paid") {
					// This is a simplified example, you should map variants to token amounts
					const amount = body.meta.custom_data?.token_amount || 1000;

					await prisma.$transaction([
						prisma.user.update({
							where: { id: userId },
							data: { tokens: { increment: amount } },
						}),
						prisma.tokenPurchase.create({
							data: {
								userId,
								amount,
								pricePaid: attributes.total / 100,
								currency: attributes.currency,
								lemonSqueezyId: data.id.toString(),
								status: "COMPLETED",
							},
						}),
						prisma.tokenTransaction.create({
							data: {
								userId,
								amount,
								type: "PURCHASE",
								metadata: { orderId: data.id.toString() },
							},
						}),
					]);
					logger.info(
						`Credited ${amount} tokens to user ${userId} via order ${data.id}`,
					);
				}
				break;
			}
		}

		return c.json({ success: true });
	} catch (err) {
		logger.error({ err }, `Error processing LemonSqueezy webhook ${eventName}`);
		return c.json({ error: "Internal server error" }, 500);
	}
});

export { lemonsqueezyRouter };
