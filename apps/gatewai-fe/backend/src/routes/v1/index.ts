import { Hono } from "hono";
import { canvasRoutes } from "./canvas.js";
import { nodeTemplatesRoutes } from "./node-templates.js";
import { tasksRouter } from "./tasks.js";
import { assetsRouter } from "./assets.js";

const v1Router = new Hono()
	.route("/canvas", canvasRoutes)
	.route("/node-templates", nodeTemplatesRoutes)
	.route("/tasks", tasksRouter)
	.route("/assets", assetsRouter);

export { v1Router };
