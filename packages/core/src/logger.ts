import pino from "pino";

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
