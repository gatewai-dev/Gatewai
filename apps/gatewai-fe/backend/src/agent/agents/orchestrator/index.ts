import { prisma, type Canvas } from "@gatewai/db";
import { LlmAgent } from "@google/adk";
import { GetCanvasEntities } from "../../../data-ops/canvas.js";
import { localGatewaiMCPTool } from "../../tools/gatewai-mcp.js";
import { NODE_CONFIG_RAW } from "../../context/node-config.js";

const BASE_INSTRUCTION = `
You are an agent that orchestrates sub agents to achieve the task user assigned to you.
When user gives you a task:
1- Analyze current canvas state and think about user's request, return with follow-up questions if you're not sure about request.
2- Analyze the user's request with current canvas state in mind.
3- Create a plan about how to create required workflow in Gatewai canvas.
4- Use the provided tools to modify the Canvas.
5. HUMAN-IN-THE-LOOP PROTOCOL:
   - Before performing high-cost or creative actions (like running a workflow), you MUST stop and present the plan to the user.
   - Use a clear question: "I have prepared the workflow for [X]. Should I proceed with execution?"
   - DO NOT call the "runWorkflow" tool until the user has explicitly provided a "proceed" or "yes" in the chat history.
6- After running workflow by a tool call, check the output, create a review observation by using provided tools.
    - You may create new nodes for this, for example connecting ImageGen node output to a LLM reference image input.
7- When you accomplish the task or user says stop, summarize your actions and return it to user. IF required only, provide next steps suggestions to user.

EACH LLM CALL YOU MADE CONTAINS LATEST CANVAS STATE, SO YOU DON'T NEED A TOOL CALL FOR THAT
Below is the Fresh Canvas State:
{{canvas_state}}

The Node Templates you can use to create workflows.
{{node_templates_list}}

Node Config Schemas:
${NODE_CONFIG_RAW}
`;

const CreateOrchestratorAgentForCanvas = async ({
	canvasId,
}: {
	canvasId: Canvas["id"];
}) => {
	const nodeTemplates = await prisma.nodeTemplate.findMany({
		include: {
			templateHandles: true
		}
	})

	const NodeTemplatesList = JSON.stringify(nodeTemplates);

	const OrchestratorAgent = new LlmAgent({
		model: "gemini-3-flash-preview",
		name: "Gatewai_Orchestrator_Agent",
		description: "Orchestrator Agent for Gatewai",
		tools: [localGatewaiMCPTool],

		// For each llm call, make sure we fetch the fresh canvas state
		beforeModelCallback: ({ request }) => {
			const freshCanvasState = GetCanvasEntities(canvasId);
			if (request?.config) {
				request.config.systemInstruction = BASE_INSTRUCTION.replace(
					"{{canvas_state}}",
					JSON.stringify(freshCanvasState, null, 2),
				).replace("{{node_templates_list}}",
					NodeTemplatesList
				);
			}
			return undefined;
		},
	});

	return OrchestratorAgent;
};

export { CreateOrchestratorAgentForCanvas };
