import { Hono } from "hono";
import { canvasRoutes } from "./canvas.js";
import { nodeTemplatesRoutes } from "./node-templates.js";

const v1Router = new Hono();

v1Router.route('/canvas', canvasRoutes)
v1Router.route('/node-templates', nodeTemplatesRoutes)

export { v1Router };