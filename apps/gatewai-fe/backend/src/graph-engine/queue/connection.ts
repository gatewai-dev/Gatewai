import type { ConnectionOptions } from "bullmq";
import { ENV_CONFIG } from "../../config.js";

export const redisConnection: ConnectionOptions = {
	host: ENV_CONFIG.REDIS_HOST,
	port: parseInt(ENV_CONFIG.REDIS_PORT, 10),
	password: ENV_CONFIG.REDIS_PASSWORD,
};

// Constructing the Redis Connection String
const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = ENV_CONFIG;
const auth = REDIS_PASSWORD ? `:${REDIS_PASSWORD}@` : "";

export const REDIS_CONN_STR = `redis://${auth}${REDIS_HOST}:${REDIS_PORT}`;
