import { ENV_CONFIG, logger } from "@gatewai/core";
import { prisma } from "@gatewai/db";
import {
	checkout,
	polar,
	portal,
	usage,
	webhooks,
} from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import type { BenefitMeterCredit } from "@polar-sh/sdk/models/components/benefitmetercredit.js";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { SubscriptionProrationBehavior } from "@polar-sh/sdk/models/components/subscriptionprorationbehavior.js";

export const polarClient = new Polar({
	accessToken: ENV_CONFIG.POLAR_ACCESS_TOKEN,
	server: "sandbox",
	debugLogger: console,
});

export const handleOrderPaid = async (order: Order) => {
	const customerId = order.customerId;
	const userId = order.customer?.externalId;
	const customerEmail = order.customer?.email;

	logger.info(
		`Polar Webhook [onOrderPaid]: Order ${order.id} for customer ${customerEmail} (ID: ${customerId}, ExternalID: ${userId})`,
	);

	if (!userId) {
		logger.warn(
			`Polar onOrderPaid: no externalId for customer ${customerId} (order ${order.id})`,
		);
		return;
	}

	const productId = order.productId;
	if (!productId) {
		logger.warn(`Polar onOrderPaid: No productId for order ${order.id}`);
		return;
	}

	const product = await polarClient.products.get({ id: productId });
	const meterBenefit = product.benefits?.find(
		(b): b is BenefitMeterCredit => b.type === "meter_credit",
	);
	const rawTokenAmount =
		order.product?.metadata?.tokenCredits ?? meterBenefit?.properties.units;
	let tokenAmount = 0;

	if (typeof rawTokenAmount === "number") {
		tokenAmount = rawTokenAmount;
	} else if (typeof rawTokenAmount === "string") {
		tokenAmount = parseInt(rawTokenAmount, 10);
	}

	if (!tokenAmount) {
		logger.warn(
			`Polar onOrderPaid: No token credits found for product ${order.productId} (order ${order.id})`,
		);
	}

	// Always create a transaction record for history
	if (tokenAmount > 0) {
		await prisma.tokenTransaction.create({
			data: {
				userId,
				amount: tokenAmount,
				type: "PURCHASE",
				metadata: {
					polarOrderId: order.id,
					productId: order.productId,
					productName: order.product?.name,
				},
			},
		});
	}

	// Sync total balance from Polar (Source of Truth)
	await syncTokenBalance(userId);
};

export const handleSubscriptionActive = async (sub: Subscription) => {
	const userId = sub.customer?.externalId;
	const customerEmail = sub.customer?.email;

	logger.info(
		`Polar Webhook [onSubscriptionActive]: Subscription ${sub.id} is active for ${customerEmail} (ID: ${sub.customerId}, ExternalID: ${userId})`,
	);

	if (!userId) {
		logger.warn(
			`Polar onSubscriptionActive: no externalId for customer ${sub.customerId} (sub ${sub.id})`,
		);
		return;
	}

	const meterBenefit = sub.product?.benefits?.find(
		(b: any): b is BenefitMeterCredit => b.type === "meter_credit",
	);
	const rawTokenCredits =
		sub.product?.metadata?.tokenCredits ?? meterBenefit?.properties.units;
	let tokenCredits = 0;

	if (typeof rawTokenCredits === "number") {
		tokenCredits = rawTokenCredits;
	} else if (typeof rawTokenCredits === "string") {
		tokenCredits = parseInt(rawTokenCredits, 10);
	}

	if (!tokenCredits) {
		logger.warn(
			`Polar onSubscriptionActive: No token credits found for product ${sub.productId} (sub ${sub.id})`,
		);
	}

	// Always create a transaction record for history
	if (tokenCredits > 0) {
		await prisma.tokenTransaction.create({
			data: {
				userId,
				amount: tokenCredits,
				type: "SUBSCRIPTION_REFILL",
				metadata: {
					polarSubscriptionId: sub.id,
					productId: sub.productId,
					productName: sub.product?.name,
				},
			},
		});
	}

	// Sync total balance from Polar (Source of Truth)
	await syncTokenBalance(userId);
};

export const handleOrderRefunded = async (order: Order) => {
	const userId = order.customer?.externalId;
	const customerEmail = order.customer?.email;

	logger.info(
		`Polar Webhook [onOrderRefunded]: Order ${order.id} refunded for ${customerEmail} (ExternalID: ${userId})`,
	);

	if (!userId) return;

	const productId = order.productId;
	if (!productId) {
		logger.warn(`Polar onOrderRefunded: No productId for order ${order.id}`);
		return;
	}

	const product = await polarClient.products.get({ id: productId });
	const meterBenefit = product.benefits?.find(
		(b): b is BenefitMeterCredit => b.type === "meter_credit",
	);
	const rawTokenAmount =
		order.product?.metadata?.tokenCredits ?? meterBenefit?.properties.units;
	let tokenAmount = 0;

	if (typeof rawTokenAmount === "number") {
		tokenAmount = rawTokenAmount;
	} else if (typeof rawTokenAmount === "string") {
		tokenAmount = parseInt(rawTokenAmount, 10);
	}

	if (tokenAmount > 0) {
		await prisma.tokenTransaction.create({
			data: {
				userId,
				amount: -tokenAmount,
				type: "REFUND",
				metadata: {
					polarOrderId: order.id,
					refundedAt: new Date().toISOString(),
				},
			},
		});
	}

	// Sync total balance from Polar (Source of Truth)
	await syncTokenBalance(userId);
};

export const getUserSubscription = async (userId: string) => {
	const subsResult = await polarClient.subscriptions.list({
		externalCustomerId: userId,
		active: true,
		limit: 1,
	});

	return subsResult.result?.items?.[0] ?? null;
};

export const updateUserSubscription = async (
	userId: string,
	productId: string,
) => {
	const subsResult = await polarClient.subscriptions.list({
		externalCustomerId: userId,
		active: true,
		limit: 10,
	});

	const subscriptions = subsResult.result?.items ?? [];
	if (!subscriptions.length) {
		throw new Error("No active subscription found");
	}

	// Pick the highest-tier active subscription to update
	const currentSub = [...subscriptions].sort((a, b) => {
		const ta = Number(a.product?.metadata?.tier) || 0;
		const tb = Number(b.product?.metadata?.tier) || 0;
		return tb - ta;
	})[0];

	// Fetch target product to check its tier
	const targetProduct = await polarClient.products.get({ id: productId });
	if (!targetProduct) throw new Error("Target product not found");

	const currentTier = Number(currentSub.product?.metadata?.tier) || 0;
	const targetTier = Number(targetProduct.metadata?.tier) || 0;
	const isUpgrade = targetTier > currentTier;

	await polarClient.subscriptions.update({
		id: currentSub.id,
		subscriptionUpdate: {
			productId,
			prorationBehavior: isUpgrade
				? SubscriptionProrationBehavior.Invoice
				: SubscriptionProrationBehavior.Prorate,
		},
	});

	return {
		subscriptionId: currentSub.id,
		isUpgrade,
	};
};

export const getPlans = async () => {
	try {
		const productsResult = await polarClient.products.list({});
		return productsResult.result.items;
	} catch (error) {
		logger.error("Failed to fetch plans from Polar:", error);
		return null;
	}
};

export const ingestUsageEvent = async (userId: string, tokens: number) => {
	try {
		await polarClient.events.ingest({
			events: [
				{
					name: "token_usage",
					externalCustomerId: userId,
					metadata: {
						amount: tokens,
					},
				},
			],
		});
		logger.debug(
			`Ingested usage event to Polar for user ${userId}: ${tokens} tokens`,
		);
	} catch (error) {
		logger.error(`Failed to ingest usage event for user ${userId}:`, error);
	}
};

export const syncTokenBalance = async (userId: string) => {
	try {
		const metersResult = await polarClient.customerMeters.list({
			externalCustomerId: userId,
		});

		const meters = metersResult.result.items;
		// Find the meter for tokens. Look for "token" in name.
		const tokenMeter =
			meters.find((m) =>
				m.meter.name.toLowerCase().includes("Gatewai Tokens"),
			) || meters[0];

		if (tokenMeter) {
			await prisma.user.update({
				where: { id: userId },
				data: { tokens: tokenMeter.balance },
			});
			logger.info(
				`Synced token balance for user ${userId}: ${tokenMeter.balance} (Meter: ${tokenMeter.meter.name})`,
			);
			return tokenMeter.balance;
		} else {
			logger.warn(`No token meter found for user ${userId}`);
		}
	} catch (error) {
		logger.error(`Failed to sync token balance for user ${userId}:`, error);
	}
	return null;
};

// Fetch products at startup to configure the checkout plugin
const initialProductsResult = await polarClient.products.list({
	// Filter for products with tokenCredits to distinguish plans from other products
});
const initialProducts = initialProductsResult.result.items.filter(
	(p) => p.metadata?.tokenCredits !== undefined,
);

export const polarPlugin = polar({
	client: polarClient,
	createCustomerOnSignUp: true,
	use: [
		checkout({
			products: initialProducts.map((p) => ({
				productId: p.id,
				slug: p.name.toLowerCase(),
			})),
			successUrl: "/success?checkout_id={CHECKOUT_ID}",
			authenticatedUsersOnly: true,
		}),
		portal(),
		usage(),
		webhooks({
			secret: ENV_CONFIG.POLAR_WEBHOOK_SECRET || "",
			onCheckoutCreated: async (payload) => {
				const checkout = payload.data;
				logger.info(
					`Polar Webhook [onCheckoutCreated]: Checkout ${checkout.id} created for ${checkout.customerEmail}. Product: ${checkout.productId}`,
				);
			},
			onCheckoutUpdated: async (payload) => {
				const checkout = payload.data;
				logger.info(
					`Polar Webhook [onCheckoutUpdated]: Checkout ${checkout.id} updated. Status: ${checkout.status}`,
				);
			},
			onOrderPaid: async (payload) => {
				await handleOrderPaid(payload.data);
			},
			onSubscriptionActive: async (payload) => {
				await handleSubscriptionActive(payload.data);
			},
			onSubscriptionUpdated: async (payload) => {
				const sub = payload.data;
				const userId = sub.customer?.externalId;
				const customerEmail = sub.customer?.email;

				logger.info(
					`Polar Webhook [onSubscriptionUpdated]: Subscription ${sub.id} updated for ${customerEmail} (ExternalID: ${userId}). Product: ${sub.productId}, Status: ${sub.status}`,
				);
			},
			onSubscriptionCanceled: async (payload) => {
				const sub = payload.data;
				const userId = sub.customer?.externalId;
				const customerEmail = sub.customer?.email;

				logger.info(
					`Polar Webhook [onSubscriptionCanceled]: Subscription ${sub.id} canceled for ${customerEmail} (ExternalID: ${userId}). Will end at ${sub.endsAt ?? "period end"}.`,
				);
			},
			onSubscriptionRevoked: async (payload) => {
				const sub = payload.data;
				const userId = sub.customer?.externalId;
				const customerEmail = sub.customer?.email;

				logger.info(
					`Polar Webhook [onSubscriptionRevoked]: Subscription ${sub.id} revoked for ${customerEmail} (ExternalID: ${userId}). Access terminated.`,
				);
			},
			onSubscriptionUncanceled: async (payload) => {
				const sub = payload.data;
				const userId = sub.customer?.externalId;
				const customerEmail = sub.customer?.email;

				logger.info(
					`Polar Webhook [onSubscriptionUncanceled]: Subscription ${sub.id} uncanceled for ${customerEmail} (ExternalID: ${userId}).`,
				);
			},
			onOrderRefunded: async (payload) => {
				await handleOrderRefunded(payload.data);
			},
			onBenefitGrantCreated: async (payload) => {
				const grant = payload.data;
				logger.info(
					`Polar Webhook [onBenefitGrantCreated]: Benefit grant ${grant.id} created for customer ${grant.customerId}. Benefit: ${grant.benefitId}`,
				);
			},
			onBenefitGrantRevoked: async (payload) => {
				const grant = payload.data;
				logger.info(
					`Polar Webhook [onBenefitGrantRevoked]: Benefit grant ${grant.id} revoked for customer ${grant.customerId}.`,
				);
			},
			onPayload: async (payload) => {
				logger.info(`Polar Webhook [onPayload]: Received ${payload.type}`);
				await prisma.webhookEvent.create({
					data: {
						eventName: payload.type,
						body: payload,
					},
				});
			},
		}),
	],
});
