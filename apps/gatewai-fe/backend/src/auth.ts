import { prisma } from "@gatewai/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { ENV_CONFIG } from "./config.js";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
		debugLogs: false,
	}),
	trustedOrigins:
		process.env.NODE_ENV === "production"
			? [process.env.FRONTEND_URL || ""]
			: ["http://localhost:5173"],
	baseURL:
		process.env.NODE_ENV === "development"
			? process.env.FRONTEND_URL
			: process.env.BACKEND_URL,
	socialProviders: {
		google: {
			clientId: ENV_CONFIG.GOOGLE_CLIENT_ID,
			clientSecret: ENV_CONFIG.GOOGLE_CLIENT_SECRET,
			accessType: "offline",
			prompt: "select_account+consent",
		},
	},
}) as ReturnType<typeof betterAuth>;

export const authMiddleware = createMiddleware(async (c, next) => {
	const session = c.get("session");
	if (!session) {
		const errorResponse = new Response("Unauthorized", {
			status: 401,
			headers: {
				Authenticate: 'error="invalid_token"',
			},
		});
		throw new HTTPException(401, { res: errorResponse });
	}
	await next();
});

export type AuthHonoTypes = {
	user: typeof auth.$Infer.Session.user | null;
	session: typeof auth.$Infer.Session.session | null;
};
