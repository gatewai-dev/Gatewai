import "reflect-metadata";

import { readFile } from "node:fs/promises";
import { logger as appLogger, ENV_CONFIG } from "@gatewai/core";
import { prisma } from "@gatewai/db";
import { syncNodeTemplates } from "@gatewai/graph-engine";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { startAgentWorker } from "./agent/agent-queue.js";
import { type AuthHonoTypes, auth, ensureUsersAPI_KEY } from "./auth.js";
import { registerBackendServices } from "./di-setup.js";
import { startWorker } from "./graph-engine/queue/workflow.worker.js";
import {
	errorHandler,
	loggerMiddleware,
	notFoundHandler,
} from "./middlewares.js";
import { v1Router } from "./routes/v1/index.js";

// Initialize Dependency Injection Container
registerBackendServices();
// Register backend processors
import "./graph-engine/processors/index.js";

const app = new Hono<{
	Variables: AuthHonoTypes;
}>()
	.use(loggerMiddleware)
	.use(async (c, next) => {
		await next();
		c.header("X-Frame-Options", "SAMEORIGIN");
		c.header("X-XSS-Protection", "1; mode=block");
		c.header("X-Content-Type-Options", "nosniff");
		c.header("Referrer-Policy", "strict-origin-when-cross-origin");
		c.header(
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains",
		);
	})
	.onError(errorHandler)
	.use("*", async (c, next) => {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session) {
			c.set("user", null);
			c.set("session", null);
			return next();
		}
		c.set("user", session.user);
		c.set("session", session.session);
		return next();
	})
	.use(
		"/api/*",
		cors({
			origin:
				process.env.NODE_ENV === "production"
					? ENV_CONFIG.BASE_URL
					: ["http://localhost:5173"],
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	)
	.on(["POST", "GET"], "/api/auth/*", async (c) => {
		return await auth.handler(c.req.raw);
	})
	.get("/session", (c) => {
		const session = c.get("session") || null;
		const user = c.get("user") || null;

		if (!user) return c.body(null, 401);

		return c.json({
			session,
			user,
		});
	})
	.route("/api/v1", v1Router)
	.get("/api/v1/test-error", () => {
		throw new Error("Test Unhandled Exception");
	})
	.get("/api/v1/test-500", (c) => {
		return c.json({ error: "Explicit 500" }, 500);
	})
	.get("/env.js", (c) => {
		const env = {
			VITE_BASE_URL: ENV_CONFIG.BASE_URL,
			DISABLE_EMAIL_SIGNUP: ENV_CONFIG.DISABLE_EMAIL_SIGNUP,
		};
		return c.text(`window.GATEWAI_ENV = ${JSON.stringify(env)}; `, 200, {
			"Content-Type": "application/javascript",
		});
	});

// We're splitting here so that RPC types works well - At least for VS Code
app
	.use("*", serveStatic({ root: "./dist" }))
	// If no file was found, serve index.html for client-side routing
	.get("*", async (c) => {
		try {
			// Adjust this path to where your index.html lives relative to execution
			const html = await readFile("./dist/index.html", "utf-8");
			return c.html(html);
		} catch (_e) {
			return c.text("404 Not Found", 404);
		}
	})
	.notFound(notFoundHandler);

// Sync node templates from manifest registry
await syncNodeTemplates(prisma);
await ensureUsersAPI_KEY();

// Initialize canvas worker.
await startWorker();

// Initialize agent worker.
startAgentWorker();

serve(
	{
		fetch: app.fetch,
		port: ENV_CONFIG.PORT,
		hostname: "0.0.0.0",
	},
	(info) => {
		appLogger.info(`Server is running on port ${info.port} (0.0.0.0)`);
	},
);

export type AppType = typeof app;
