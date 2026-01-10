// src/queues/node-queue.js

import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

const nodeQueue = new Queue("node-processing", {
	connection: redisConnection,
});

export { nodeQueue };
