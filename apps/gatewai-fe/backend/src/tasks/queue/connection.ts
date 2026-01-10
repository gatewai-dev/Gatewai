import type { ConnectionOptions } from "bullmq";
import { ENV_CONFIG } from "../../config.js";

export const redisConnection: ConnectionOptions = {
	host: ENV_CONFIG.REDIS_HOST || "localhost",
	port: parseInt(ENV_CONFIG.REDIS_PORT || "6379", 10),
	password: ENV_CONFIG.REDIS_PASSWORD,
};
