import { Hono } from "hono";
import { canvasRoutes } from "./canvas.js";
import { nodeTemplatesRoutes } from "./node-templates.js";

const v1Router = new Hono()
    .route('/canvas', canvasRoutes)
    .route('/node-templates', nodeTemplatesRoutes)

export { v1Router };