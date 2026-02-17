import { Hono } from "hono";
import { authMiddleware } from "../../auth.js";
import { apiKeysRoutes } from "./api-keys.js";
import { apiRunRoutes } from "./api-run.js";
import { assetsRouter } from "./assets.js";
import { canvasRoutes } from "./canvas.js";
import { fontsRouter } from "./fonts.js";
import { nodeTemplatesRoutes } from "./node-templates.js";
import { nodesRouter } from "./nodes.js";
import { tasksRouter } from "./tasks.js";

const v1Router = new Hono()
	.use(authMiddleware)
	.route("/nodes", nodesRouter)
	.route("/node-templates", nodeTemplatesRoutes)
	.route("/tasks", tasksRouter)
	.route("/assets", assetsRouter)
	.route("/fonts", fontsRouter)
	.route("/api-run", apiRunRoutes)
	.route("/api-keys", apiKeysRoutes)
	.route("/canvas", canvasRoutes);

export { v1Router };
