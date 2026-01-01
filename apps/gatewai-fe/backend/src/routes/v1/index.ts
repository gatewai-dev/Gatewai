import { Hono } from "hono";
import { assetsRouter } from "./assets.js";
import { canvasRoutes } from "./canvas.js";
import { fontsRouter } from "./fonts.js";
import { nodeTemplatesRoutes } from "./node-templates.js";
import { tasksRouter } from "./tasks.js";

const v1Router = new Hono()
	.route("/canvas", canvasRoutes)
	.route("/node-templates", nodeTemplatesRoutes)
	.route("/tasks", tasksRouter)
	.route("/assets", assetsRouter)
	.route("/fonts", fontsRouter);

export { v1Router };
