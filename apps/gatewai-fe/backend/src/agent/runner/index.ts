import { type MessageRole, prisma } from "@gatewai/db";
import { run } from "@openai/agents";
import { CreateOrchestratorAgentForCanvas } from "../agents/orchestrator/index.js";
import { localGatewaiMCPTool } from "../tools/gatewai-mcp.js";

export const RunCanvasAgent = async ({
	canvasId,
	sessionId,
	userMessage,
}: {
	canvasId: string;
	sessionId: string;
	userMessage: string;
}) => {
	// 1. Initialize Agent
	const agent = await CreateOrchestratorAgentForCanvas({ canvasId });

	// 2. Load History (Map Prisma messages to Agent messages)
	// The OpenAI Runner is stateless by default unless we pass history,
	// but typically we want to just pass the conversation history.
	// const dbMessages = await prisma.message.findMany({
	//     where: { threadId: sessionId },
	//     orderBy: { createdAt: 'asc' }
	// });
	//
	// // Convert DB messages to OpenAI format (simplified for brevity)
	// // Note: In a real app, you'd map tool calls and outputs carefully.
	// const history = dbMessages.map(m => ({
	//     role: m.role.toLowerCase(),
	//     content: JSON.parse(JSON.stringify(m.content)), // Handle JSON content
	// }));

	// 3. Add the new user message to DB and history
	await prisma.message.create({
		data: {
			threadId: sessionId,
			role: "USER",
			content: userMessage,
		},
	});

	await localGatewaiMCPTool.connect();
	// 5. Execute
	const result = await run(agent, userMessage);

	// 6. Save Result to DB
	// The result.finalOutput contains the text response.
	// If tools were called, you might want to save those intermediate steps too (messages list).
	if (result.finalOutput) {
		await prisma.message.create({
			data: {
				threadId: sessionId,
				role: "MODEL",
				content: result.finalOutput,
			},
		});
	}

	return result;
};
