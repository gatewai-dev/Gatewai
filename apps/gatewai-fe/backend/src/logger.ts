import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "debug",
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["email", "password", "accessToken", "refreshToken", "req.headers.authorization"],
    remove: true,
  },
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

import type { Context, Next } from "hono";

// 1. Request/Response Middleware
export const loggerMiddleware = async (c: Context, next: Next) => {
  const { method, url } = c.req;
  const start = Date.now();

  await next();

  const status = c.res.status;
  const duration = `${Date.now() - start}ms`;

  const logPayload = { method, url, status, duration };

  if (status >= 500) {
    logger.error(logPayload, "❌ Server Error");
  } else if (status >= 400) {
    logger.warn(logPayload, "⚠️ Client Error");
  } else {
    logger.info(logPayload, "✅ Request Processed");
  }
};

// 2. Global Error Handler (500s)
export const errorHandler = (err: Error, c: Context) => {
  logger.error(
    {
      err: err.message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
      url: c.req.url,
    },
    "🔥 Unhandled Exception"
  );
  return c.json({ error: "Internal Server Error" }, 500);
};

// 3. Not Found Handler (404s)
export const notFoundHandler = (c: Context) => {
  logger.warn({ url: c.req.url, method: c.req.method }, "❓ Route Not Found");
  return c.json({ error: "Not Found" }, 404);
};