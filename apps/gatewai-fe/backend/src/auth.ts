import { prisma } from "@gatewai/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { ENV_CONFIG } from "./config.js";

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
		debugLogs: false,
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
}) as ReturnType<typeof betterAuth>;

export const authMiddleware = createMiddleware(async (c, next) => {
	const session = c.get("session");
	if (!session) {
		// Check root api key if user is unauthorized
		const apiKey = ENV_CONFIG.GATEWAI_API_KEY;
		const hasValidAPIKey = c.req.header("X-API-KEY") === apiKey;
		if (!hasValidAPIKey) {
			const errorResponse = new Response("Unauthorized", {
				status: 401,
				headers: {
					Authenticate: 'error="invalid_token"',
				},
			});
			throw new HTTPException(401, { res: errorResponse });
		}
	}
	await next();
});

export type AuthHonoTypes = {
	user: typeof auth.$Infer.Session.user | null;
	session: typeof auth.$Infer.Session.session | null;
};

export type AuthorizedHonoTypes = {
	user: typeof auth.$Infer.Session.user;
	session: typeof auth.$Infer.Session.session;
};
