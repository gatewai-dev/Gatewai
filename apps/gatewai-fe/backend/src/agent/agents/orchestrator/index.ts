import { prisma } from "@gatewai/db";
import { bulkUpdateSchema } from "@gatewai/types";
import { Agent, type AgentInputItem } from "@openai/agents";
import { zodToJsonSchema } from "zod-to-json-schema";
import { GetCanvasEntities } from "../../../data-ops/canvas.js";
import { getAgentModel } from "../../agent-model.js";
import type { PrismaAgentSession } from "../../session/gatewai-session.js";
import { createPatcherAgent } from "../patcher/index.js";
import { BASE_SYSTEM_PROMPT } from "./prompts.js";

export const CreateOrchestratorAgentForCanvas = async ({
	canvasId,
	session,
	modelName,
}: {
	canvasId: string;
	session: PrismaAgentSession;
	modelName: string;
}) => {
	const nodeTemplates = await prisma.nodeTemplate.findMany({
		include: { templateHandles: true },
	});
	const templatesStr = JSON.stringify(nodeTemplates, null, 2);
	const jsonSchema = zodToJsonSchema(bulkUpdateSchema, {
		name: "bulkUpdateSchema",
	});
	const schemaString = JSON.stringify(jsonSchema, null, 2);
	const getInstructions = async () => {
		const freshState = await GetCanvasEntities(canvasId);

		const items = await session.getItems();
		const historyStr = items
			.filter(
				(item): item is Extract<AgentInputItem, { role: string }> =>
					"role" in item && (item.role === "user" || item.role === "assistant"),
			)
			.map((item) => {
				const role = item.role.toUpperCase();
				let content = "";

				if (Array.isArray(item.content)) {
					content = item.content
						.map((part: any) => (typeof part === "string" ? part : part.text))
						.join("\n");
				} else {
					content = item.content;
				}

				// Attempt to parse and extract text if it's a stringified JSON message object
				if (typeof content === "string" && content.trim().startsWith("{")) {
					try {
						const parsed = JSON.parse(content);
						if (
							parsed.type === "message" &&
							typeof parsed.content === "string"
						) {
							content = parsed.content;
						} else if (parsed.text && typeof parsed.text === "string") {
							content = parsed.text;
						}
					} catch (e) {
						// Not valid JSON or different structure, keep original content
					}
				}

				return `${role}: ${content}`;
			})
			.filter((line) => line.split(": ")[1]?.trim())
			.join("\n\n---\n\n");

		return `${BASE_SYSTEM_PROMPT}

# SESSION CONTEXT

**Session ID:** ${session.id}
(Use this ID when calling 'propose-canvas-update' tool)

**Canvas ID:** ${canvasId}

# AVAILABLE NODE TEMPLATES

${templatesStr}

# CURRENT CANVAS STATE (FETCHED WHEN USER SENT LAST MESSAGE)

${JSON.stringify(freshState, null, 2)}

# CONVERSATION HISTORY

${historyStr || "No prior conversation history."}

# Canvas Specification Schema

Check the specs for the canvas to understand valid properties and types for node configurations.

\`\`\`json
${schemaString}
\`\`\`

# BEGIN ANALYSIS

Now process the user's request following the CORE OPERATING PROTOCOL above.
Remember:
1. Analyze the request.
2. Design the architecture.
3. Call \`modify_canvas\` with a detailed description of the changes, \`agentSessionId: "${session.id}"\` and \`canvasId: "${canvasId}"\`.
4. Inform the user to review.


`;
	};

	function assertIsValidName(
		modelName: string,
	): asserts modelName is
		| "gemini-3-pro-preview"
		| "gemini-3-flash-preview"
		| "gemini-2.5-pro" {
		const validModels = [
			"gemini-3-pro-preview",
			"gemini-3-flash-preview",
			"gemini-2.5-pro",
		];

		if (!validModels.includes(modelName)) {
			throw new Error(
				`Invalid model name: ${modelName}. Expected one of ${validModels.join(", ")}`,
			);
		}
	}
	assertIsValidName(modelName);

	const model = getAgentModel(modelName);
	const patcherAgentTool = createPatcherAgent(modelName);
	// Note: We return the function reference for instructions to enable dynamic fetching
	return new Agent({
		name: "Gatewai_Copilot",
		model,
		instructions: getInstructions,
		tools: [patcherAgentTool],
	});
};
