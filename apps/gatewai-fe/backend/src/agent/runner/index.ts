import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "@openai/agents";
import { CreateOrchestratorAgentForCanvas } from "../agents/orchestrator/index.js";
import { PrismaAgentSession } from "../session/gatewai-session.js";
import { connectMCP } from "../tools/gatewai-mcp.js";
import { GatewaiRunContext } from "./run-context.js";

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
	const session = new PrismaAgentSession({ sessionId, canvasId });
	try {
		const agent = await CreateOrchestratorAgentForCanvas({
			canvasId,
			session,
			modelName: model,
		});
		await connectMCP();
		const context = new GatewaiRunContext();
		const result = await run(agent, userMessage, {
			stream: true,
			session,
			context,
			signal,
		});

		for await (const chunk of result.toStream()) {
			console.log({ chunk: JSON.stringify(chunk, null, 2) });
			yield chunk;
		}
	} finally {
		await session.completeSession();
	}
};
