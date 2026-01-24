import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "@openai/agents";
import { CreateOrchestratorAgentForCanvas } from "../agents/orchestrator/index.js";
import { PrismaAgentSession } from "../session/gatewai-session.js";
import { localGatewaiMCPTool } from "../tools/gatewai-mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const RunCanvasAgent = async function* ({
	canvasId,
	sessionId,
	userMessage,
}: {
	canvasId: string;
	sessionId: string;
	userMessage: string;
}) {
	const logDir = path.join(__dirname, "logs");
	const logPath = path.join(logDir, `session_${sessionId}.log`);

	const session = new PrismaAgentSession({ sessionId, canvasId });
	const agent = await CreateOrchestratorAgentForCanvas({ canvasId, session });
	await localGatewaiMCPTool.connect();

	const result = await run(agent, userMessage, { stream: true, session });

	for await (const chunk of result.toStream()) {
		if (process.env.NODE_ENV === "development") {
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
