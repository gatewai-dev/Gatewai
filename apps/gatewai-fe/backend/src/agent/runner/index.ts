import { run } from "@openai/agents";
import { logger } from "../../logger.js";
import { CreateOrchestratorAgentForCanvas } from "../agents/orchestrator/index.js";
import { PrismaAgentSession } from "../session/gatewai-session.js";
import { connectMCP, createGatewaiMCPTool } from "../tools/gatewai-mcp.js";
import { GatewaiRunContext } from "./run-context.js";

export const RunCanvasAgent = async function* ({
	canvasId,
	sessionId,
	userMessage,
	model,
	signal,
	authHeaders = {},
}: {
	canvasId: string;
	sessionId: string;
	userMessage: string;
	model: string;
	signal?: AbortSignal;
	authHeaders?: Record<string, string>;
}) {
	const session = new PrismaAgentSession({ sessionId, canvasId });
	try {
		// Create MCP tool for this run context
		const mcpTool = createGatewaiMCPTool(authHeaders);

		const agent = await CreateOrchestratorAgentForCanvas({
			canvasId,
			session,
			modelName: model,
			mcpTool,
		});

		await connectMCP(mcpTool);
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
