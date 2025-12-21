import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator'
import z from "zod";
import { streamSSE } from 'hono/streaming'
import { HTTPException } from "hono/http-exception";
import { prisma } from "@gatewai/db";
import { canvasRoutes } from "./canvas.js";

const v1Router = new Hono();

v1Router.route('/canvas', canvasRoutes)

export { v1Router };