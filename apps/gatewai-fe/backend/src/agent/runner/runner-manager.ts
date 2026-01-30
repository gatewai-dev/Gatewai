import { redisPublisher } from "../../lib/redis.js";
import { RunCanvasAgent } from "./index.js";

// biome-ignore lint/complexity/noStaticOnlyClass: Required
// A Agent runner that uses redis for the events
export class AgentRunnerManager {
	private static activeSessions = new Map<
		string,
		{ accumulatedText: string }
	>();
	private static controllers = new Map<string, AbortController>();

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
		if (AgentRunnerManager.activeSessions.has(sessionId)) {
			console.log(`Session ${sessionId} is already running.`);
			return;
		}

		const controller = new AbortController();
		AgentRunnerManager.controllers.set(sessionId, controller);
		AgentRunnerManager.activeSessions.set(sessionId, { accumulatedText: "" });
		const channel = `agent:session:${sessionId}`;

		// Start background execution
		(async () => {
			try {
				const runner = RunCanvasAgent({
					canvasId,
					sessionId,
					userMessage: message,
					model,
					signal: controller.signal,
				});

				for await (const chunk of runner) {
					if (controller.signal.aborted) break;

					// Track accumulated text for model deltas
					if (
						chunk.type === "raw_model_stream_event" &&
						chunk.data?.type === "output_text_delta"
					) {
						const sessionData =
							AgentRunnerManager.activeSessions.get(sessionId);
						if (sessionData) {
							sessionData.accumulatedText += chunk.data.delta || "";
						}
					}

					await redisPublisher.publish(channel, JSON.stringify(chunk));
				}

				// Signal completion
				await redisPublisher.publish(channel, JSON.stringify({ type: "done" }));
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") {
					console.log(`Session ${sessionId} was aborted.`);
				} else {
					console.error(`Error in session ${sessionId}:`, error);
					await redisPublisher.publish(
						channel,
						JSON.stringify({
							type: "error",
							error: error instanceof Error ? error.message : "Unknown error",
						}),
					);
				}
			} finally {
				AgentRunnerManager.activeSessions.delete(sessionId);
				AgentRunnerManager.controllers.delete(sessionId);
			}
		})();
	}

	static stop(sessionId: string) {
		const controller = AgentRunnerManager.controllers.get(sessionId);
		if (controller) {
			controller.abort();
			return true;
		}
		return false;
	}

	static isRunning(sessionId: string) {
		return AgentRunnerManager.activeSessions.has(sessionId);
	}

	static getAccumulatedText(sessionId: string) {
		return (
			AgentRunnerManager.activeSessions.get(sessionId)?.accumulatedText || null
		);
	}
}
