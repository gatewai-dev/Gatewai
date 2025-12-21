import { Hono } from "hono";
import { canvasRoutes } from "./canvas.js";
import { nodeRouter } from "./nodes.js";

const v1Router = new Hono();

v1Router.route('/canvas', canvasRoutes)
v1Router.route('/nodes', nodeRouter);

export { v1Router };