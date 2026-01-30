import { redisPublisher } from "../../lib/redis.js";
import { agentQueue } from "../../lib/agent-queue.js";

// A Agent runner that uses BullMQ and redis for the events
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
			if (state === 'active' || state === 'waiting' || state === 'delayed') {
				console.log(`Session ${sessionId} is already running (Job state: ${state}).`);
				return;
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
				removeOnComplete: true, // Auto clean up completed jobs to allow re-running same session if needed?
				// Actually, if we use same sessionId for multiple turns, we might have ID collision if checking existingJob. 
				// BUT, usually a session is a long living thing? 
				// Wait, "Session" in the user's context seems to be a chat session.
				// The `RunCanvasAgent` runs an exchange.
				// If the user sends another message, is it the same sessionId?
				// The API route `POST /:id/agent/:sessionId` implies yes.
				// If so, `jobId: sessionId` means we can only have one job per session *at a time*.
				// Which is correct, we generally queue messages.
				// But `removeOnComplete: true` is important so we can add a NEW job for the next message.
				removeOnFail: false,
			},
		);
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
			if (state === 'waiting' || state === 'delayed') {
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
		return state === 'active' || state === 'waiting' || state === 'delayed';
	}

	static async getAccumulatedText(sessionId: string) {
		const paramsKey = `agent:session:${sessionId}:accumulated`;
		const text = await redisPublisher.get(paramsKey);
		return text || null;
	}
}
