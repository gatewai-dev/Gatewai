import assert from "node:assert";
import { bulkUpdateSchema } from "@gatewai/core/types";
import { GetCanvasEntities } from "@gatewai/data-ops";
import { prisma } from "@gatewai/db";
import {
	Agent,
	type AgentInputItem,
	type MCPServerStreamableHttp,
} from "@openai/agents";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AVAILABLE_AGENT_MODELS, getAgentModel } from "../../agent-model.js";
import type { PrismaAgentSession } from "../../session/gatewai-session.js";
import { createPatcherAgent } from "../patcher/index.js";
import { BASE_SYSTEM_PROMPT } from "./prompts.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Safely extract plain-text content from an AgentInputItem content field.
 * Handles strings, arrays of parts, and stringified JSON message objects.
 */
function extractTextContent(
	content: AgentInputItem extends { role: string; content: infer C }
		? C
		: unknown,
): string {
	if (typeof content === "string") {
		return tryUnwrapJsonMessage(content);
	}

	if (Array.isArray(content)) {
		return content
			.map((part: unknown) => {
				if (typeof part === "string") return tryUnwrapJsonMessage(part);
				if (part && typeof part === "object" && "text" in part) {
					return tryUnwrapJsonMessage(String((part as { text: unknown }).text));
				}
				return "";
			})
			.filter(Boolean)
			.join("\n");
	}

	return "";
}

/**
 * If `raw` looks like a JSON message envelope (e.g. `{ type: "message", content: "..." }`),
 * unwrap and return just the inner string. Otherwise return `raw` as-is.
 */
function tryUnwrapJsonMessage(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed.startsWith("{")) return trimmed;

	try {
		const parsed: unknown = JSON.parse(trimmed);
		if (parsed && typeof parsed === "object") {
			const obj = parsed as Record<string, unknown>;
			if (obj.type === "message" && typeof obj.content === "string") {
				return obj.content;
			}
			if (typeof obj.text === "string") {
				return obj.text;
			}
		}
	} catch {
		// Not JSON – return as-is
	}
	return trimmed;
}

/**
 * Serialise session history into a readable conversation string for the system prompt.
 * Only user/assistant turns are included; empty lines are dropped.
 */
async function buildHistoryString(
	session: PrismaAgentSession,
): Promise<string> {
	const items = await session.getItems();

	const lines = items
		.filter(
			(item): item is Extract<AgentInputItem, { role: string }> =>
				"role" in item && (item.role === "user" || item.role === "assistant"),
		)
		.map((item) => {
			const role = item.role.toUpperCase();
			const text = extractTextContent(
				item.content as Parameters<typeof extractTextContent>[0],
			).trim();
			return text ? `${role}: ${text}` : null;
		})
		.filter((line): line is string => line !== null);

	return lines.length > 0
		? lines.join("\n\n---\n\n")
		: "No prior conversation history.";
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export const CreateOrchestratorAgentForCanvas = async ({
	canvasId,
	session,
	modelName,
	mcpTool,
}: {
	canvasId: string;
	session: PrismaAgentSession;
	modelName: string;
	mcpTool: MCPServerStreamableHttp;
}) => {
	// Validate model name early and with a clear error message
	if (!(AVAILABLE_AGENT_MODELS as readonly string[]).includes(modelName)) {
		throw new Error(
			`Invalid model name: "${modelName}". Must be one of: ${AVAILABLE_AGENT_MODELS.join(", ")}`,
		);
	}

	// Pre-fetch node templates and schema string once at agent creation time
	// (they are static for the lifetime of this agent instance)
	const nodeTemplates = await prisma.nodeTemplate.findMany({
		include: { templateHandles: true },
	});
	const templatesStr = JSON.stringify(nodeTemplates, null, 2);

	const jsonSchema = zodToJsonSchema(bulkUpdateSchema, {
		name: "bulkUpdateSchema",
	});
	const schemaString = JSON.stringify(jsonSchema, null, 2);

	/**
	 * Dynamic instructions factory — called by the Agent SDK before every turn.
	 * Fetches a fresh canvas snapshot and the latest session history each time.
	 */
	const getInstructions = async (): Promise<string> => {
		const [freshState, historyStr] = await Promise.all([
			GetCanvasEntities(canvasId).catch((err: unknown) => {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(`[Orchestrator] Failed to fetch canvas entities: ${msg}`);
				return { nodes: [], edges: [], handles: [] };
			}),
			buildHistoryString(session),
		]);

		return `${BASE_SYSTEM_PROMPT}

# SESSION CONTEXT

**Session ID:** ${session.id}
**Canvas ID:** ${canvasId}

# AVAILABLE NODE TEMPLATES

${templatesStr}

# CURRENT CANVAS STATE (live -- fetched now)

${JSON.stringify(freshState, null, 2)}

# CONVERSATION HISTORY (for context only)

IMPORTANT: The messages below are a log of what was *said*. They do NOT represent canvas state.
A task description or plan appearing here does NOT mean the modify_canvas tool was ever called.
If the user's latest request requires a canvas change, you MUST call modify_canvas now.

${historyStr}

# CANVAS SPECIFICATION SCHEMA

\`\`\`json
${schemaString}
\`\`\`

# BEGIN ANALYSIS

Process the user's request following the CORE OPERATING PROTOCOL.
Remember:
1. Analyse the request and current canvas state.
2. Design the architecture. Verify AI-node configs against template constraints.
3. Call \`modify_canvas\` with a detailed description, \`agentSessionId: "${session.id}"\`, and \`canvasId: "${canvasId}"\`.
4. Inform the user to review the proposed changes.
`;
	};

	const model = getAgentModel(
		modelName as (typeof AVAILABLE_AGENT_MODELS)[number],
	);
	// Pass canvasId and agentSessionId directly so the patcher never has to parse
	// them from a freeform string — which was the root cause of "Canvas not found" errors.
	assert(session.id);
	const patcherAgentTool = createPatcherAgent(
		modelName as (typeof AVAILABLE_AGENT_MODELS)[number],
		mcpTool,
		canvasId,
		session.id,
	);

	return new Agent({
		name: "Gatewai_Copilot",
		model,
		instructions: getInstructions,
		toolUseBehavior: { stopAtToolNames: ["modify_canvas"] },
		tools: [patcherAgentTool],
	});
};
