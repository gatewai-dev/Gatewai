import { Hono } from "hono";
import { auth, type AuthHonoTypes } from "./auth.js";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { APP_CONFIG } from "./config.js";
import { v1Router } from "./routes/v1/index.js";

const app = new Hono<{
	Variables: AuthHonoTypes
}>();

app.use(
	"/api/*",
	cors({
		origin: "http://localhost:8081",
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS"],
		exposeHeaders: ["Content-Length"],
		maxAge: 600,
		credentials: true,
	}),
);

app.use("*", async (c, next) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
 
  	if (!session) {
		c.set("user", null);
		c.set("session", null);
		return next();
  	}
 
  	c.set("user", session.user);
  	c.set("session", session.session);
  	return next();
});

app.on(["POST", "GET"], "/api/auth/*", async (c) => {
	const res = await auth.handler(c.req.raw);
	return res;
});

app.get("/session", (c) => {
	const session = c.get("session") || null;
	const user = c.get("user") || null;

	if(!user) return c.body(null, 401);

	return c.json({
	  session,
	  user
	});
});

app.route('/api/v1', v1Router)

serve({
  fetch: app.fetch,
  port: APP_CONFIG.PORT
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

export type AppType = typeof app
