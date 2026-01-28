import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "@openai/agents";
import { ENV_CONFIG } from "../../config.js";
import { CreateOrchestratorAgentForCanvas } from "../agents/orchestrator/index.js";
import { PrismaAgentSession } from "../session/gatewai-session.js";
import { connectMCP } from "../tools/gatewai-mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const RunCanvasAgent = async function* ({
	canvasId,
	sessionId,
	userMessage,
	model,
	signal,
}: {
	canvasId: string;
	sessionId: string;
	userMessage: string;
	model: string;
	signal?: AbortSignal;
}) {
	const logDir = path.join(__dirname, "logs");
	const logPath = path.join(logDir, `session_${sessionId}.log`);

	const session = new PrismaAgentSession({ sessionId, canvasId });
	try {
		const agent = await CreateOrchestratorAgentForCanvas({
			canvasId,
			session,
			modelName: model,
		});
		await connectMCP();

		const result = await run(agent, userMessage, {
			stream: true,
			session,
			signal,
		});

		for await (const chunk of result.toStream()) {
			console.log({ chunk });
			yield chunk;
		}
	} finally {
		await session.completeSession();
	}
};
