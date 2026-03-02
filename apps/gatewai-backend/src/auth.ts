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
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { apiKey } from "better-auth/plugins";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { BASIC_PRODUCT_ID, MAX_PRODUCT_ID, PRO_PRODUCT_ID } from "./polar";

export const polarClient = new Polar({
	accessToken: ENV_CONFIG.POLAR_ACCESS_TOKEN,
	server: "sandbox",
	debugLogger: console,
});

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	trustedOrigins: [ENV_CONFIG.BASE_URL, "http://localhost:5173"],
	baseURL: ENV_CONFIG.BASE_URL,
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		autoSignIn: true,
		disableSignUp: ENV_CONFIG.DISABLE_EMAIL_SIGNUP,
	},
	plugins: [
		apiKey({
			apiKeyHeaders: "X-API-KEY",
		}),
		polar({
			client: polarClient,
			createCustomerOnSignUp: true,
			use: [
				checkout({
					products: [
						{
							productId: BASIC_PRODUCT_ID,
							slug: "basic",
						},
						{
							productId: PRO_PRODUCT_ID,
							slug: "pro",
						},
						{
							productId: MAX_PRODUCT_ID,
							slug: "max",
						},
					],
					successUrl: "/success?checkout_id={CHECKOUT_ID}",
					authenticatedUsersOnly: true,
				}),
				portal(),
				usage(),
				webhooks({
					secret: ENV_CONFIG.POLAR_WEBHOOK_SECRET || "",
					onOrderPaid: async (payload) => {
						const order = payload.data;
						const customerId = order.customerId;
						const userId = order.customer?.externalId;
						if (!userId) {
							logger.warn(
								`Polar onOrderPaid: no externalId for customer ${customerId}`,
							);
							return;
						}
						const tokenAmount =
							(order.product?.metadata as Record<string, unknown>)
								?.tokenCredits ?? 0;
						if (typeof tokenAmount === "number" && tokenAmount > 0) {
							await prisma.$transaction([
								prisma.user.update({
									where: { id: userId },
									data: { tokens: { increment: tokenAmount } },
								}),
								prisma.tokenTransaction.create({
									data: {
										userId,
										amount: tokenAmount,
										type: "PURCHASE",
										metadata: {
											polarOrderId: order.id,
											productId: order.productId,
										},
									},
								}),
							]);
							logger.info(
								`Credited ${tokenAmount} tokens to user ${userId} via Polar order ${order.id}`,
							);
						}
					},
					onSubscriptionActive: async (payload) => {
						const sub = payload.data;
						const userId = sub.customer?.externalId;
						if (!userId) return;

						const tokenCredits =
							(sub.product?.metadata as Record<string, unknown>)
								?.tokenCredits ?? 0;
						if (typeof tokenCredits === "number" && tokenCredits > 0) {
							await prisma.$transaction([
								prisma.user.update({
									where: { id: userId },
									data: { tokens: { increment: tokenCredits } },
								}),
								prisma.tokenTransaction.create({
									data: {
										userId,
										amount: tokenCredits,
										type: "SUBSCRIPTION_REFILL",
										metadata: {
											polarSubscriptionId: sub.id,
											productId: sub.productId,
										},
									},
								}),
							]);
							logger.info(
								`Refilled ${tokenCredits} tokens for user ${userId} (subscription ${sub.id})`,
							);
						}
					},
					onOrderRefunded: async (payload) => {
						const order = payload.data;
						const userId = order.customer?.externalId;
						if (!userId) return;
						const tokenAmount =
							(order.product?.metadata as Record<string, unknown>)
								?.tokenCredits ?? 0;
						if (typeof tokenAmount === "number" && tokenAmount > 0) {
							await prisma.$transaction([
								prisma.user.update({
									where: { id: userId },
									data: { tokens: { decrement: tokenAmount } },
								}),
								prisma.tokenTransaction.create({
									data: {
										userId,
										amount: -tokenAmount,
										type: "REFUND",
										metadata: {
											polarOrderId: order.id,
											refundedAt: new Date().toISOString(),
										},
									},
								}),
							]);
							logger.info(
								`Refund processed for Polar order ${order.id}: deducted ${tokenAmount} from user ${userId}`,
							);
						}
					},
					onPayload: async (payload) => {
						console.log({ payload });
						await prisma.webhookEvent.create({
							data: {
								eventName: payload.type,
								body: payload,
							},
						});
					},
				}),
			],
		}),
	],
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					// Auto-generate a default API token for the new user
					const key = `gte_${crypto.randomUUID().replace(/-/g, "")}`;
					await prisma.apiKey.create({
						data: {
							key: key,
							name: "Default API Key",
							userId: user.id,
							start: key.substring(0, 4), // Store prefix for display
							prefix: "gte",
						},
					});
				},
			},
		},
	},
}) as ReturnType<typeof betterAuth>;

export const authMiddleware = createMiddleware(async (c, next) => {
	const session = c.get("session");
	if (!session) {
		// Check for API key in headers
		const apiKeyHeader = c.req.header("X-API-KEY");

		if (apiKeyHeader) {
			// 1. Look up API Key
			const keyRecord = await prisma.apiKey.findUnique({
				where: { key: apiKeyHeader },
				include: { user: true },
			});

			if (keyRecord) {
				// 2. Set User Context from API Key
				c.set("user", keyRecord.user);
				c.set("session", {
					id: "api-key-session",
					userId: keyRecord.userId,
					expiresAt: new Date(Date.now() + 1000 * 60 * 60),
					token: apiKeyHeader,
					createdAt: new Date(),
					updatedAt: new Date(),
					ipAddress: c.req.header("x-forwarded-for") || null,
					userAgent: c.req.header("user-agent") || null,
				});
				c.set("isApiKeyAuth", true);

				// 3. Update Last Used (Fire and forget)
				await prisma.apiKey.update({
					where: { id: keyRecord.id },
					data: { lastUsedAt: new Date() },
				});

				await next();
				return;
			}
		}

		if (!apiKeyHeader) {
			// No session, no API key header -> Unauthorized (handled by throwing)
			return c.json(
				{ error: "Unauthorized", message: "Missing or invalid API key" },
				401,
				{
					"WWW-Authenticate": 'Bearer error="invalid_token"',
				},
			);
		}

		// API Key provided but not found in DB or Global
		const errorResponse = new Response("Unauthorized - Invalid API Key", {
			status: 401,
		});
		throw new HTTPException(401, { res: errorResponse });
	}
	await next();
});

export type AuthHonoTypes = {
	user: typeof auth.$Infer.Session.user | null;
	session: typeof auth.$Infer.Session.session | null;
	isApiKeyAuth?: boolean;
};

export type AuthorizedHonoTypes = {
	user: typeof auth.$Infer.Session.user;
	session: typeof auth.$Infer.Session.session;
	isApiKeyAuth?: boolean;
};

// Union type for auth helpers to work with both contexts
export type AnyAuthHonoTypes = AuthHonoTypes | AuthorizedHonoTypes;

export const ensureUsersAPI_KEY = async () => {
	const users = await prisma.user.findMany({
		where: {
			apiKeys: {
				none: {},
			},
		},
	});

	if (users.length > 0) {
		logger.info(`Found ${users.length} users without API Key. Generating...`);
		for (const user of users) {
			const key = `gte_${crypto.randomUUID().replace(/-/g, "")}`;
			await prisma.apiKey.create({
				data: {
					key: key,
					name: "Default API Key",
					userId: user.id,
					start: key.substring(0, 4), // Store prefix for display
					prefix: "gte",
				},
			});
		}
		logger.info("Generated API Keys for existing users.");
	}
};
