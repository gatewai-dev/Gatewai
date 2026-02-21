import { Hono } from "hono";
import { authMiddleware } from "../../auth.js";
import { apiKeysRoutes } from "./api-keys.js";
import { apiRunRoutes } from "./api-run.js";
import { assetsPublicRouter, assetsRouter } from "./assets.js";
import { canvasRoutes } from "./canvas.js";
import { fontsRouter } from "./fonts.js";
import { nodeTemplatesRoutes } from "./node-templates.js";
import { nodesRouter } from "./nodes.js";
import { tasksRouter } from "./tasks.js";

const v1Router = new Hono()
	.route("/fonts", fontsRouter)
	// Public asset reads: streaming, thumbnails, temp files — no auth required.
	// Asset IDs are opaque cuid2 values, providing security-by-obscurity.
	// Browser video players fire parallel range requests which can race against
	// the session lookup, causing intermittent 401s when behind authMiddleware.
	.route("/assets", assetsPublicRouter)
	.use(authMiddleware)
	.route("/nodes", nodesRouter)
	.route("/node-templates", nodeTemplatesRoutes)
	.route("/tasks", tasksRouter)
	.route("/assets", assetsRouter)
	.route("/api-run", apiRunRoutes)
	.route("/api-keys", apiKeysRoutes)
	.route("/canvas", canvasRoutes);

export { v1Router };
