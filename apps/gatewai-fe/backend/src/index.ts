import { Readable } from "node:stream";
import { prisma, SEED_createNodeTemplates } from "@gatewai/db";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono/jsx";
import { logger } from "hono/logger";
import { stream } from "hono/streaming";
import mime from "mime-types";
import { ENV_CONFIG } from "./config.js";
import { startWorker } from "./graph-engine/queue/workflow.worker.js";
import { logger as appLogger } from "./logger.js";
import { v1Router } from "./routes/v1/index.js";
import { storage } from "./utils/storage.js";

console.log(process.env);
const isProd = process.env.NODE_ENV === "production";

const CORS_ORIGIN =
	process.env.NODE_ENV === "production"
		? ENV_CONFIG.BASE_URL
		: "http://localhost:5173";

const app = new Hono()
	.use(logger())
	.use(
		"/api/*",
		cors({
			origin: CORS_ORIGIN,
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	)
	.route("/api/v1", v1Router);

if (isProd) {
	app.get("*", async (c) => {
		const url = new URL(c.req.url);
		let path = url.pathname.replace(/^\//, ""); // Remove leading slash

		// SPA Routing: Default to index.html if no file extension exists
		if (path === "" || !path.includes(".")) {
			path = "index.html";
		}
		const bucket = storage.bucket(ENV_CONFIG.GCS_ASSETS_BUCKET);
		const gcsPath = `fe_dist/${path}`;
		const file = bucket.file(gcsPath);
		const [exists] = await file.exists();

		// Fallback to index.html if the specific asset isn't found
		const targetFile = exists ? file : bucket.file("index.html");
		const filePath = exists ? gcsPath : "index.html";

		const [metadata] = await targetFile.getMetadata();

		// Set Content-Type manually since we're streaming
		const contentType =
			metadata.contentType ||
			mime.lookup(filePath) ||
			"application/octet-stream";
		c.header("Content-Type", contentType);
		const gcsStream = targetFile.createReadStream();
		const readStr = Readable.toWeb(gcsStream) as ReadableStream;
		return c.body(readStr, {
			headers: {
				"Access-Control-Allow-Origin": CORS_ORIGIN,
			},
		});
	});
} else {
	app.get("*", serveStatic({ root: "./dist" }));
}

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
