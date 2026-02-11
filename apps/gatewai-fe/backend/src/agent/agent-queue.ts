import { ENV_CONFIG, logger } from "@gatewai/core";
import type { GatewaiDoneEvent, GatewaiErrorEvent } from "@gatewai/types";
import { type Job, Queue, Worker } from "bullmq";
import { redisPublisher } from "../lib/redis.js";
import { RunCanvasAgent } from "./runner/index.js";

const connection = {
	host: ENV_CONFIG.REDIS_HOST,
	port: ENV_CONFIG.REDIS_PORT,
	password: ENV_CONFIG.REDIS_PASSWORD,
};

export const agentQueue = new Queue("agent-tasks", { connection });

async function processAgentJob(job: Job) {
	const { canvasId, sessionId, message, model, authHeaders } = job.data;
	const channel = `agent:session:${sessionId}`;
	const accumulatedKey = `agent:session:${sessionId}:accumulated`;
	const stopKey = `agent:session:${sessionId}:stop`;

	// Initialize controller for cancellation
	const controller = new AbortController();
	console.log(job.data)
	try {
		logger.info({ sessionId }, "Starting agent job");

		// Clear previous accumulated text to avoid phantom typing
		await redisPublisher.del(accumulatedKey);

		const runner = RunCanvasAgent({
			canvasId,
			sessionId,
			userMessage: message,
			model,
			signal: controller.signal,
			authHeaders,
		});

		for await (const chunk of runner) {
			// Check for cancellation signal from Redis
			const stopSignal = await redisPublisher.get(stopKey);
			if (stopSignal) {
				logger.info({ sessionId }, "Agent job cancelled via stop signal");
				controller.abort();
				break;
			}

			// Check if job is still active in BullMQ
			const isActive = await job.isActive();
			if (!isActive) {
				logger.info({ sessionId }, "Agent job no longer active in BullMQ");
				controller.abort();
				break;
			}

			// Persist accumulated text
			if (
				chunk.type === "raw_model_stream_event" &&
				chunk.data?.type === "output_text_delta"
			) {
				await redisPublisher.append(accumulatedKey, chunk.data.delta || "");
				// Set expiry to 24h
				await redisPublisher.expire(accumulatedKey, 60 * 60 * 24);
			}

			// Publish to real-time subscribers
			await redisPublisher.publish(channel, JSON.stringify(chunk));
		}

		// Clean up stop key
		await redisPublisher.del(stopKey);

		if (controller.signal.aborted) {
			// If aborted, maybe publish an error/aborted message if needed
			// For now, just logging
		} else {
			// Signal completion
			const doneEvent: GatewaiDoneEvent = { type: "done" };
			await redisPublisher.publish(channel, JSON.stringify(doneEvent));
		}
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			logger.info(`Session ${sessionId} was aborted.`);
		} else {
			// Sanitize error to avoid circular references (e.g. from Axios errors)
			const safeError =
				error instanceof Error
					? {
						name: error.name,
						message: error.message,
						stack: error.stack,
						cause: (error as any).cause,
					}
					: error;
			logger.error({ err: safeError, sessionId }, `Error in session`);
			const errorEvent: GatewaiErrorEvent = {
				type: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			};
			await redisPublisher.publish(channel, JSON.stringify(errorEvent));
			// Re-throw to fail the job in BullMQ
			throw error;
		}
	}
}

export const startAgentWorker = () => {
	logger.info("Starting agent worker...");
	const worker = new Worker("agent-tasks", processAgentJob, {
		connection,
		concurrency: ENV_CONFIG.MAX_CONCURRENT_ASSISTANT_JOBS,
	});

	worker.on("failed", (job, err) => {
		logger.error({ jobId: job?.id, err }, "Agent job failed");
	});

	worker.on("completed", (job) => {
		logger.info({ jobId: job.id }, "Agent job completed");
	});

	return worker;
};
