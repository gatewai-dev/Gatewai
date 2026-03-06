import pino from "pino";

// Define a minimal interface to mock AsyncLocalStorage in the browser
interface ALS {
	getStore(): Record<string, unknown> | undefined;
	run<R, TArgs extends any[]>(
		store: Record<string, unknown>,
		callback: (...args: TArgs) => R,
		...args: TArgs
	): R;
}

// Global context explicitly for logger
// We initialize it with a dummy fallback for browser compatibility
export let loggerContext: ALS = {
	getStore: () => undefined,
	run: (_store, callback, ...args) => callback(...args),
};

if (typeof window === "undefined") {
	// Node environment: Replace with real AsyncLocalStorage asynchronously
	import("node:async_hooks")
		.then((module) => {
			loggerContext = new module.AsyncLocalStorage<Record<string, unknown>>();
		})
		.catch(() => {
			// Fallback if unavailable
		});
}

// Define Logger interface to match what we had in types
export interface Logger {
	info: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
	debug: (...args: unknown[]) => void;
}

export const logger: Logger = pino({
	level: process.env.LOG_LEVEL || "debug",
	timestamp: pino.stdTimeFunctions.isoTime,
	mixin() {
		return loggerContext.getStore() || {};
	},
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
