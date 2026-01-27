import { HTTPException } from "hono/http-exception";
import pino from "pino";
import { assertIsError } from "./utils/misc.js";

export const logger = pino({
	level: process.env.LOG_LEVEL || "debug",
	timestamp: pino.stdTimeFunctions.isoTime,
	redact: {
		paths: [
			"email",
			"password",
			"accessToken",
			"refreshToken",
			"req.headers.authorization",
		],
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

	try {
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
	} catch (err) {
		const duration = `${Date.now() - start}ms`;
		assertIsError(err);

		logger.error(
			{
				method,
				url,
				duration,
				err: err.message,
				stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
			},
			"💥 Request Failed with Exception",
		);

		// Re-throw to let Hono's onError handle it
		throw err;
	}
};

export const errorHandler = (err: Error, c: Context) => {
	const isHTTPException = err instanceof HTTPException;
	const status = isHTTPException ? err.status : 500;

	logger.error(
		{
			err: err.message,
			stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
			url: c.req.url,
			status,
		},
		isHTTPException ? "⚠️ HTTP Exception" : "🔥 Unhandled Exception",
	);

	if (!isHTTPException) {
		console.error(err);
	}
	console.log({ err });
	return c.json(
		{
			error: isHTTPException ? err.message : "Internal Server Error",
		},
		status,
	);
};

export const notFoundHandler = (c: Context) => {
	logger.warn({ url: c.req.url, method: c.req.method }, "❓ Route Not Found");
	return c.json({ error: "Not Found" }, 404);
};
