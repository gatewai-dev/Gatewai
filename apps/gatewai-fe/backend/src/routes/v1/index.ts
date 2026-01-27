import { Hono } from "hono";
import { authMiddleware } from "../../auth.js";
import { apiRunRoutes } from "./api-run.js";
import { assetsRouter } from "./assets.js";
import { canvasRoutes } from "./canvas.js";
import { fontsRouter } from "./fonts.js";
import { nodeTemplatesRoutes } from "./node-templates.js";
import { tasksRouter } from "./tasks.js";

const v1Router = new Hono()
	.use(authMiddleware)
	.route("/canvas", canvasRoutes)
	.route("/node-templates", nodeTemplatesRoutes)
	.route("/tasks", tasksRouter)
	.route("/assets", assetsRouter)
	.route("/fonts", fontsRouter)
	.route("/api-run", apiRunRoutes);

export { v1Router };
