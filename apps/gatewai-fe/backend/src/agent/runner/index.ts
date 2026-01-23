import { prisma } from "@gatewai/db";
import { run } from "@openai/agents";
import { CreateOrchestratorAgentForCanvas } from "../agents/orchestrator/index.js";
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
	// 1. Persist User Message
	await prisma.message.create({
		data: {
			agentSessionId: sessionId,
			role: "USER",
			content: userMessage,
		},
	});

	// 2. Initialize Agent
	const agent = await CreateOrchestratorAgentForCanvas({ canvasId });
	await localGatewaiMCPTool.connect();

	// 3. Execute with streaming enabled
	// Note: result.stream is available in the @openai/agents runner
	const result = await run(agent, userMessage, { stream: true });
	
	let fullResponse = "";

	// 4. Yield chunks to the caller
	for await (const chunk of result.toStream()) {
		console.log({chunk})
		if (chunk.type === "raw_model_stream_event") {
			if (chunk.data.type === 'output_text_delta') {
				const delta = chunk.data.delta;
				fullResponse += delta;
			}
		}
		yield chunk;
	}

	// 5. Finalize: Save Model Response to DB
	if (fullResponse) {
		await prisma.message.create({
			data: {
				agentSessionId: sessionId,
				role: "MODEL",
				content: fullResponse,
			},
		});
	}
};