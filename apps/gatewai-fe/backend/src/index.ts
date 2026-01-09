import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ENV_CONFIG } from "./config.js";
import { logger as appLogger } from "./logger.js";
import { v1Router } from "./routes/v1/index.js";
import { BatchRecovery } from "./tasks/batch-recovery.js";

console.log(process.env);

const app = new Hono()
	.use(logger())
	.use(
		"/api/*",
		cors({
			origin:
				process.env.NODE_ENV === "production"
					? process.env.VITE_BASE_URL || ""
					: "http://localhost:5173",
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	)
	.route("/api/v1", v1Router);

serve(
	{
		fetch: app.fetch,
		port: ENV_CONFIG.PORT,
	},
	(info) => {
		appLogger.info(`Server is running on http://localhost:${info.port}`);
	},
);

const batchRecovery = new BatchRecovery();
batchRecovery.resumeDanglingBatches();

export type AppType = typeof app;
