import { run } from "@openai/agents";
import { CreateOrchestratorAgentForCanvas } from "../agents/orchestrator/index.js";
import { PrismaAgentSession } from "../session/gatewai-session.js";
import { connectMCP } from "../tools/gatewai-mcp.js";
import { GatewaiRunContext } from "./run-context.js";
import { logger } from "../../logger.js";

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
		logger.debug({ toolLogs: context.getToolLogs() }, "Agent run completed");
		for await (const chunk of result.toStream()) {
			logger.debug({ chunk }, "Agent stream chunk");
			yield chunk;
		}
	} finally {
		await session.completeSession();
	}
};
