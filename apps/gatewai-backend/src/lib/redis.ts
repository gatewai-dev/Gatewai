import { ENV_CONFIG } from "@gatewai/core";
import { Redis } from "ioredis";

const redisConfig = {
	host: ENV_CONFIG.REDIS_HOST,
	port: ENV_CONFIG.REDIS_PORT,
	password: ENV_CONFIG.REDIS_PASSWORD,
};

export const redisPublisher = new Redis(redisConfig);
export const redisSubscriber = new Redis(redisConfig);
