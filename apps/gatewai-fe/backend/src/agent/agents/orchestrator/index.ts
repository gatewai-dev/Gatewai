import { prisma } from "@gatewai/db";
import { Agent } from "@openai/agents";
import { GetCanvasEntities } from "../../../data-ops/canvas.js";
import { agentModel } from "../../agent-model.js";
import { NODE_CONFIG_RAW } from "../../context/node-config.js";
import { localGatewaiMCPTool } from "../../tools/gatewai-mcp.js";

const BASE_SYSTEM_PROMPT = `
You are the Gatewai Orchestrator Agent.
Your goal is to manage the user's creative workflow on a node-based canvas.

**CORE PROTOCOLS:**
1. **Analyze First:** Look at the 'Current Canvas State' below.
2. **Plan & Confirm:** - Before running any workflow (high cost), you MUST present a plan to the user.
    - Ask: "I have prepared the workflow for [X]. Should I proceed with execution?"
    - WAIT for the user to say "yes" or "proceed".
    - DO NOT call 'run_workflow' without this confirmation.
3. **Execution:** Use the provided tools to modify the canvas structure.

**RULES:**
- Looping connections are forbidden.
- Input handles accept only one connection; Outputs accept many.
- Data types must match between connected handles.

**NODE CONFIG SCHEMA:**
${NODE_CONFIG_RAW}
`;

export const CreateOrchestratorAgentForCanvas = async ({
	canvasId,
}: {
	canvasId: string;
}) => {
	// Fetch static templates once
	const nodeTemplates = await prisma.nodeTemplate.findMany({
		include: { templateHandles: true },
	});
	const templatesStr = JSON.stringify(nodeTemplates);

	// Dynamic Instructions Function
	// This runs before EVERY turn to inject fresh state
	const getInstructions = async () => {
		const freshState = await GetCanvasEntities(canvasId);

		return `${BASE_SYSTEM_PROMPT}

        ---
        **AVAILABLE NODE TEMPLATES:**
        ${templatesStr}

        **CURRENT FRESH CANVAS STATE:**
        ${JSON.stringify(freshState, null, 2)}
        `;
	};

	return new Agent({
		name: "Gatewai_Orchestrator",
		model: agentModel,
		instructions: getInstructions,
		mcpServers: [localGatewaiMCPTool],
	});
};
