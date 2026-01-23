import { run } from "@openai/agents";
import { CreateOrchestratorAgentForCanvas } from "../agents/orchestrator/index.js";
import { PrismaAgentSession } from "../session/gatewai-session.js";
import { localGatewaiMCPTool } from "../tools/gatewai-mcp.js";

export const RunCanvasAgent = async function* ({
	canvasId,
	sessionId,
	userMessage,
}: {
	canvasId: string;
	sessionId: string;
	userMessage: string;
}) {
	const session = new PrismaAgentSession({ sessionId, canvasId });
	// Pass session to agent creation
	const agent = await CreateOrchestratorAgentForCanvas({ canvasId, session });
	await localGatewaiMCPTool.connect();
	// 3. Execute with streaming enabled
	// Note: result.stream is available in the @openai/agents runner
	const result = await run(agent, userMessage, { stream: true, session });
	// 4. Yield chunks to the caller
	for await (const chunk of result.toStream()) {
		yield chunk;
	}
};
