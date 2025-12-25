import { Hono } from "hono";
import { auth, type AuthHonoTypes } from "./auth.js";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { ENV_CONFIG } from "./config.js";
import { v1Router } from "./routes/v1/index.js";
import { logger } from 'hono/logger'
import { prisma } from "@gatewai/db";

console.log(process.env.DATABASE_URL);
prisma.canvas.count().then(console.log)

const app = new Hono<{
	Variables: AuthHonoTypes
}>()
.use(logger())
.use(
	"/api/*",
	cors({
		origin: process.env.NODE_ENV === "production"
			? process.env.FRONTEND_URL || ""
			: "http://localhost:5173",
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS"],
		exposeHeaders: ["Content-Length"],
		maxAge: 600,
		credentials: true,
	}),
)
.use("*", async (c, next) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
  	if (!session) {
		c.set("user", null);
		c.set("session", null);
		return next();
  	}
  	c.set("user", session.user);
  	c.set("session", session.session);
  	return next();
})
.on(["POST", "GET"], "/api/auth/*", async (c) => {
	return await auth.handler(c.req.raw);
})
.get("/session", (c) => {
	const session = c.get("session") || null;
	const user = c.get("user") || null;

	if(!user) return c.body(null, 401);

	return c.json({
		session,
		user
	});
}).
route('/api/v1', v1Router)

serve({
  fetch: app.fetch,
  port: ENV_CONFIG.PORT
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

export type AppType = typeof app

