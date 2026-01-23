import { prisma } from "@gatewai/db";
import { Agent } from "@openai/agents";
import { GetCanvasEntities } from "../../../data-ops/canvas.js";
import { agentModel } from "../../agent-model.js";
import { NODE_CONFIG_RAW } from "../../context/node-config.js";
import type { PrismaAgentSession } from "../../session/gatewai-session.js";
import { localGatewaiMCPTool } from "../../tools/gatewai-mcp.js";

const BASE_SYSTEM_PROMPT = `
You are the Gatewai Orchestrator Agent.
Your goal is to manage the user's creative workflow on a node-based canvas.

**CORE PROTOCOLS:**
1. **Analyze First:** Look at the 'Current Canvas State' below.
2. **Plan & Confirm:** - Before running any workflow (high cost) or updating canvas,
you MUST present a plan to the user. If user asks the task directly, you can proceed without confirmation. Eg. "Remove Image generation node"
but you should ask for confirmation if there's two Image generation node in canvas.
    - Ask: "I have prepared the workflow for [X]. Should I proceed with execution?"
    - WAIT for the user to say "yes" or "proceed".
    - DO NOT call 'run_workflow' without this confirmation or patch canvas.
3. **Execution:** Use the provided tools to modify the canvas structure.

**RULES:**
- Looping connections are forbidden.
- Input handles accept only one connection; Outputs accept many.
- Data types must match between connected handles.
- When creating nodes, it's CRITICAL to follow same structure as node template including handles.

**WORKFLOW DESIGN PRINCIPLES:**
To create the best possible workflows, always prioritize modularity, extensibility, ease of modification, and robustness. Think step-by-step to design optimal structures:
- **Modularity:** Break down complex tasks into smaller, reusable nodes. Use separate nodes for distinct functions (e.g., input preparation, generation, processing, output). Favor composing multiple simple nodes over a single complex one where possible.
- **Extensibility:** Design workflows with clear entry/exit points. Use outputs that can branch to multiple downstream nodes, and inputs that accept variable connections. Anticipate future additions by leaving room for new nodes (e.g., add preview or branching nodes).
- **Ease of Modification:** Avoid tight coupling between nodes. Use intermediate nodes like TextMerger, Preview, or Compositor as buffers for changes. Ensure node configurations are explicit and handles are well-labeled for quick adjustments.
- **Robustness:** Incorporate error-handling where applicable (e.g., fallback prompts, validation via LLM). Include Preview nodes for intermediate checks. Design for data type compatibility and handle potential failures gracefully. Aim for workflows that are resilient to changes in inputs or configurations.
- **Optimization:** Before proposing a plan, deeply analyze the task, available node templates, and current canvas state. Consider alternatives and select the most efficient, scalable design. Explain your reasoning in the plan to the user.

**NODE CONFIG SCHEMA:**
${NODE_CONFIG_RAW}
`;

export const CreateOrchestratorAgentForCanvas = async ({
	canvasId,
	session, // Add session as a required param
}: {
	canvasId: string;
	session: PrismaAgentSession;
}) => {
	// Fetch static templates once
	const nodeTemplates = await prisma.nodeTemplate.findMany({
		include: { templateHandles: true },
	});
	const templatesStr = JSON.stringify(nodeTemplates, null, 2);

	// Dynamic Instructions Function
	// This runs before EVERY turn to inject fresh state and history
	const getInstructions = async () => {
		const freshState = await GetCanvasEntities(canvasId);

		// Load history from the session
		const items = await session.getItems();
		const historyStr = items
			.map((item) => {
				if ("role" in item) {
					const contentStr = Array.isArray(item.content)
						? item.content
								.map((c) => (typeof c === "string" ? c : JSON.stringify(c)))
								.join("\n")
						: typeof item.content === "string"
							? item.content
							: JSON.stringify(item.content);
					return `${item.role.toUpperCase()}: ${contentStr}`;
				}
				return "Unknown item";
			})
			.join("\n\n---\n\n");

		return `${BASE_SYSTEM_PROMPT}

---
**AVAILABLE NODE TEMPLATES:**
${templatesStr}

**CURRENT FRESH CANVAS STATE:**
${JSON.stringify(freshState, null, 2)}

**CONVERSATION HISTORY:**
${historyStr || "No prior history."}
`;
	};

	return new Agent({
		name: "Gatewai_Assistant",
		model: agentModel,
		instructions: getInstructions,
		mcpServers: [localGatewaiMCPTool],
	});
};
