import pino from "pino";

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
