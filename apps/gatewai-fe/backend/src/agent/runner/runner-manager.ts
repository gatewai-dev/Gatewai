import { agentQueue } from "../../lib/agent-queue.js";
import { redisPublisher } from "../../lib/redis.js";
import { logger } from "../../logger.js";

// A Agent runner that uses BullMQ and redis for the events
// biome-ignore lint/complexity/noStaticOnlyClass: Required for context
export class AgentRunnerManager {
	static async start({
		canvasId,
		sessionId,
		message,
		model,
	}: {
		canvasId: string;
		sessionId: string;
		message: string;
		model: string;
	}) {
		// Check if job already exists and is running/pending
		const existingJob = await agentQueue.getJob(sessionId);
		if (existingJob) {
			const state = await existingJob.getState();
			if (state === "active" || state === "waiting" || state === "delayed") {
				logger.info(
					{ sessionId, state },
					`Session is already running (Job state: ${state}).`,
				);
				return false;
			}
		}

		// Add to queue with sessionId as jobId for easy retrieval
		await agentQueue.add(
			"run-agent",
			{
				canvasId,
				sessionId,
				message,
				model,
			},
			{
				jobId: sessionId,
				removeOnComplete: true,
				removeOnFail: false,
			},
		);
		return true;
	}

	static async stop(sessionId: string) {
		// 1. Signal cancellation to the worker
		const stopKey = `agent:session:${sessionId}:stop`;
		await redisPublisher.set(stopKey, "true");
		// Expire stop key after short time (e.g. 1 min) just in case
		await redisPublisher.expire(stopKey, 60);

		// 2. Try to cancel the job if it's waiting
		const job = await agentQueue.getJob(sessionId);
		if (job) {
			const state = await job.getState();
			if (state === "waiting" || state === "delayed") {
				await job.remove();
				return true;
			}
			// If active, the worker will pick up the stop key.
		}
		return true;
	}

	static async isRunning(sessionId: string) {
		const job = await agentQueue.getJob(sessionId);
		if (!job) return false;
		const state = await job.getState();
		return state === "active" || state === "waiting" || state === "delayed";
	}

	static async getAccumulatedText(sessionId: string) {
		const paramsKey = `agent:session:${sessionId}:accumulated`;
		const text = await redisPublisher.get(paramsKey);
		return text || null;
	}
}
