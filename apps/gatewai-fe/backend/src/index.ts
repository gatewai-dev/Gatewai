import { readFile } from "node:fs/promises";
import { prisma, SEED_createNodeTemplates } from "@gatewai/db";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { type AuthHonoTypes, auth } from "./auth.js";
import { ENV_CONFIG } from "./config.js";
import { startWorker } from "./graph-engine/queue/workflow.worker.js";
import {
	logger as appLogger,
	errorHandler,
	loggerMiddleware,
} from "./logger.js";
import { v1Router } from "./routes/v1/index.js";

const app = new Hono<{
	Variables: AuthHonoTypes;
}>()
	.use(loggerMiddleware)
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
	.route("/api/v1", v1Router)
	.get("/env.js", (c) => {
		const env = {
			VITE_BASE_URL: ENV_CONFIG.BASE_URL,
		};
		return c.text(`window.GATEWAI_ENV = ${JSON.stringify(env)};`, 200, {
			"Content-Type": "application/javascript",
		});
	});

// Serve frontend dist (located in gatewai-fe root)

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
	});

// Initialize canvas worker.
await startWorker();

// Run seed check for node templates
await SEED_createNodeTemplates(prisma);

serve(
	{
		fetch: app.fetch,
		port: ENV_CONFIG.PORT,
	},
	(info) => {
		appLogger.info(`Server is running on port ${info.port}`);
	},
);

export type AppType = typeof app;
