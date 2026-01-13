import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ENV_CONFIG } from "./config.js";
import { logger as appLogger } from "./logger.js";
import { v1Router } from "./routes/v1/index.js";
import { startWorker } from "./tasks/queue/workflow.worker.js";

console.log(process.env);

const app = new Hono()
	.use(logger())
	.use(
		"/api/*",
		cors({
			origin:
				process.env.NODE_ENV === "production"
					? ENV_CONFIG.BASE_URL
					: "http://localhost:5173",
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	)
	.route("/api/v1", v1Router)
	.get("*", serveStatic({ root: "./dist" }));

// Initialize canvas worker.
await startWorker();

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
