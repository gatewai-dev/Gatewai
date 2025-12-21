import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator'
import z from "zod";
import { streamSSE } from 'hono/streaming'
import { HTTPException } from "hono/http-exception";
import { prisma } from "@gatewai/db";
import { canvasRoutes } from "./canvas.js";

const nodeRouter = new Hono();

nodeRouter.post('/:id/process', async (ctx) => {
    return ctx.json({ message: "Node processing not implemented yet." });
})

export { nodeRouter };