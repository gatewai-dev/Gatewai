import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "@openai/agents";
import { ENV_CONFIG } from "../../config.js";
import { logger } from "../../logger.js";
import { CreateOrchestratorAgentForCanvas } from "../agents/orchestrator/index.js";
import { PrismaAgentSession } from "../session/gatewai-session.js";
import { connectMCP, localGatewaiMCPTool } from "../tools/gatewai-mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const RunCanvasAgent = async function* ({
	canvasId,
	sessionId,
	userMessage,
	model,
}: {
	canvasId: string;
	sessionId: string;
	userMessage: string;
	model: string;
}) {
	const logDir = path.join(__dirname, "logs");
	const logPath = path.join(logDir, `session_${sessionId}.log`);

	const session = new PrismaAgentSession({ sessionId, canvasId });
	const agent = await CreateOrchestratorAgentForCanvas({
		canvasId,
		session,
		modelName: model,
	});
	await connectMCP();

	const result = await run(agent, userMessage, { stream: true, session });

	for await (const chunk of result.toStream()) {
		// Filter out unwanted raw model stream events that clutter the frontend
		if (chunk.type === "raw_model_stream_event") {
			const data = chunk.data;
			if (data?.type === "response_started") continue;
			if (data?.type === "model" && data?.event?.type === "stream-start")
				continue;
		}

		if (ENV_CONFIG.LOG_LEVEL === "debug") {
			const logEntry = {
				timestamp: new Date().toISOString(),
				type: chunk.type,
				detail:
					chunk.type === "run_item_stream_event"
						? { event: chunk.name, item: chunk.item }
						: chunk,
			};

			try {
				await mkdir(logDir, { recursive: true });
				await appendFile(logPath, JSON.stringify(logEntry) + "\n");
			} catch (err) {
				console.error(
					`Failed to write to log file for session ${sessionId}:`,
					err,
				);
			}
		}

		yield chunk;
	}
};
