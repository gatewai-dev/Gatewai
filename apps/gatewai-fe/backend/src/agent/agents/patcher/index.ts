import { prisma } from "@gatewai/db";
import { type BulkUpdatePayload, bulkUpdateSchema } from "@gatewai/types";
import { Agent, tool } from "@openai/agents";
import { VM } from "vm2";
import { z } from "zod";
import { GetCanvasEntities } from "../../../data-ops/canvas.js";
import { getAgentModel } from "../../agent-model.js";
import { localGatewaiMCPTool } from "../../tools/gatewai-mcp.js";

/**
 * Patcher Sub-Agent
 *
 * This agent writes JavaScript code to manipulate canvas state.
 * It uses vm2 to execute the code safely, validates the result,
 * and retries if the code fails or validation errors occur.
 *
 * Flow:
 * 1. Orchestrator calls this subagent via .asTool() handoff
 * 2. Subagent calls prepare_canvas to fetch state
 * 3. Subagent writes JS code to modify canvas state
 * 4. Code is executed in vm2 sandbox
 * 5. Result is validated against bulkUpdateSchema
 * 6. On success, submit_patch creates the patch via MCP
 * 7. On failure, agent retries with error context
 */

// Shared context between tool calls within a single agent run
interface PatcherContext {
	canvasId: string;
	agentSessionId: string;
	nodes: any[];
	edges: any[];
	handles: any[];
	templates: any[];
}

let patcherContext: PatcherContext | null = null;

/**
 * Tool: Prepare Canvas Context
 *
 * Fetches current canvas state and templates. Must be called first.
 */
const prepareCanvasTool = tool({
	name: "prepare_canvas",
	description: `Fetch the current canvas state and templates. You MUST call this first before execute_canvas_code.
Extract the canvasId and agentSessionId from the task description provided by the orchestrator.`,
	parameters: z.object({
		canvasId: z.string().describe("The ID of the canvas to modify"),
		agentSessionId: z.string().describe("The ID of the agent session"),
	}),
	async execute({ canvasId, agentSessionId }) {
		try {
			// Fetch current canvas state and templates
			const [{ nodes, edges, handles }, templates] = await Promise.all([
				GetCanvasEntities(canvasId),
				prisma.nodeTemplate.findMany({
					include: { templateHandles: true },
				}),
			]);

			// Store in context for other tools
			patcherContext = {
				canvasId,
				agentSessionId,
				nodes: nodes || [],
				edges: edges || [],
				handles: handles || [],
				templates,
			};

			return `Canvas prepared successfully!
- ${patcherContext.nodes.length} existing nodes
- ${patcherContext.edges.length} existing edges
- ${patcherContext.handles.length} existing handles
- ${templates.length} available templates

Available templates:
${templates.map((t: any) => `- ${t.type} (id: ${t.id})`).join("\n")}

You can now call execute_canvas_code with your JavaScript code.`;
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return `Failed to prepare canvas: ${msg}`;
		}
	},
});

/**
 * Tool: Execute Canvas Transformation Code
 *
 * Executes JavaScript code in a vm2 sandbox to transform canvas state.
 * The code has access to: nodes, edges, handles, templates, and helper functions.
 */
const executeCanvasCodeTool = tool({
	name: "execute_canvas_code",
	description: `Execute JavaScript code to transform the canvas state.

You have access to the following in your code:
- nodes: Array of current nodes
- edges: Array of current edges  
- handles: Array of current handles
- templates: Array of available node templates (with templateHandles)
- generateId(): Generate a temp ID (returns "temp-<uuid>")

Your code MUST return an object with: { nodes, edges, handles }

IMPORTANT RULES:
1. Use generateId() for ALL new entity IDs
2. Copy handle dataTypes and labels EXACTLY from template.templateHandles
3. Edges connect sourceHandleId (Output) to targetHandleId (Input)
4. No circular dependencies or self-connections
5. Each Input handle can only have ONE incoming edge

EXAMPLE CODE:
\`\`\`javascript
// Create a Text node
const textNodeId = generateId();
const textTemplate = templates.find(t => t.type === 'Text');

nodes.push({
  id: textNodeId,
  name: 'Prompt',
  type: 'Text',
  templateId: textTemplate.id,
  position: { x: 100, y: 100 },
  width: 340,
  config: { content: 'A cinematic shot of a sunset' }
});

// Add handles from template
textTemplate.templateHandles.forEach((th) => {
  handles.push({
    id: generateId(),
    type: th.type,
    dataTypes: th.dataTypes,
    label: th.label,
    order: th.order,
    nodeId: textNodeId,
    required: th.required || false,
    templateHandleId: th.id
  });
});

return { nodes, edges, handles };
\`\`\``,
	parameters: z.object({
		code: z
			.string()
			.describe(
				"JavaScript code that transforms the canvas state. Must return { nodes, edges, handles }",
			),
	}),
	async execute({ code }) {
		if (!patcherContext) {
			return "Error: Canvas not prepared. Call prepare_canvas first with canvasId and agentSessionId.";
		}

		try {
			// Create vm2 sandbox with canvas state and helpers
			const vm = new VM({
				timeout: 5000,
				sandbox: {
					nodes: JSON.parse(JSON.stringify(patcherContext.nodes)),
					edges: JSON.parse(JSON.stringify(patcherContext.edges)),
					handles: JSON.parse(JSON.stringify(patcherContext.handles)),
					templates: JSON.parse(JSON.stringify(patcherContext.templates)),
					generateId: () => `temp-${crypto.randomUUID()}`,
					console: {
						log: (...args: any[]) => console.log("[VM]", ...args),
					},
				},
			});

			// Execute the code
			const result = vm.run(`
				(function() {
					${code}
				})()
			`);

			console.log("[Patcher] VM result:", { result });

			// Validate the result structure
			if (!result || typeof result !== "object") {
				return "Error: Code must return an object with { nodes, edges, handles }";
			}

			if (!Array.isArray(result.nodes)) {
				return "Error: result.nodes must be an array";
			}
			if (!Array.isArray(result.edges)) {
				return "Error: result.edges must be an array";
			}
			if (!Array.isArray(result.handles)) {
				return "Error: result.handles must be an array";
			}

			// Validate against bulkUpdateSchema
			const payload: BulkUpdatePayload = {
				nodes: result.nodes,
				edges: result.edges,
				handles: result.handles,
			};

			const validationResult = bulkUpdateSchema.safeParse(payload);
			if (!validationResult.success) {
				const errors = validationResult.error.issues
					.map((i) => `${i.path.join(".")}: ${i.message}`)
					.join("\n");
				return `Validation failed. Fix these issues and try again:\n${errors}`;
			}

			// Store validated result back to context
			patcherContext.nodes = validationResult.data.nodes || [];
			patcherContext.edges = validationResult.data.edges || [];
			patcherContext.handles = validationResult.data.handles || [];

			return `Code executed successfully! Canvas state updated:
- ${patcherContext.nodes.length} nodes
- ${patcherContext.edges.length} edges
- ${patcherContext.handles.length} handles

Call submit_patch to create the patch proposal.`;
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return `Code execution failed: ${msg}\n\nFix the code and try again.`;
		}
	},
});

/**
 * Tool: Submit the Patch
 *
 * After successfully executing code, submit the patch for user review.
 */
const submitPatchTool = tool({
	name: "submit_patch",
	description:
		"Submit the transformed canvas state as a patch for user review. Only call this after execute_canvas_code succeeds.",
	parameters: z.object({}),
	async execute() {
		if (!patcherContext) {
			return "Error: Canvas not prepared. Call prepare_canvas first.";
		}

		try {
			const payload: BulkUpdatePayload = {
				nodes: patcherContext.nodes,
				edges: patcherContext.edges,
				handles: patcherContext.handles,
			};

			// Call MCP tool to create patch
			const result = await localGatewaiMCPTool.callTool(
				"propose-canvas-update",
				{
					canvasId: patcherContext.canvasId,
					agentSessionId: patcherContext.agentSessionId,
					canvasState: payload,
				},
			);

			// Clear context after successful submission
			const canvasId = patcherContext.canvasId;
			patcherContext = null;

			const resultText =
				Array.isArray((result as any)?.content) &&
				(result as any).content.find((c: any) => c.type === "text")?.text;

			return `Patch submitted successfully for canvas ${canvasId}! ${resultText || "The user has been notified to review the changes."}`;
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return `Failed to submit patch: ${msg}`;
		}
	},
});

/**
 * Create the Patcher Sub-Agent as a Tool
 */
export function createPatcherAgent() {
	const systemPrompt = `You are a Canvas Patcher Agent. Your job is to write JavaScript code that transforms canvas state.

## Your Tools

1. **prepare_canvas** - MUST call first to fetch canvas state
2. **execute_canvas_code** - Write and execute JS code to transform the canvas
3. **submit_patch** - Submit the final patch for user review

## Workflow

1. Extract canvasId and agentSessionId from the task description
2. Call prepare_canvas with canvasId and agentSessionId
3. Write JavaScript code to make the required changes
4. Call execute_canvas_code with your code
5. If it fails, fix the code and retry
6. Once successful, call submit_patch

## Code Guidelines

- Use generateId() for ALL new IDs
- Access current state via: nodes, edges, handles
- Access templates via: templates (each has .templateHandles array)
- Return { nodes, edges, handles } at the end
- Copy template handle properties EXACTLY (dataTypes, label, required)
- Position new nodes with proper spacing (500px horizontal, 450px vertical)

## Common Patterns

**Add a node with handles:**
\`\`\`javascript
const nodeId = generateId();
const template = templates.find(t => t.type === 'ImageGen');

// Add the node
nodes.push({
  id: nodeId,
  name: 'Generate Image',
  type: 'ImageGen',
  templateId: template.id,
  position: { x: 600, y: 100 },
  width: 340,
  config: template.defaultConfig || {}
});

// Add handles from template
template.templateHandles.forEach((th) => {
  handles.push({
    id: generateId(),
    type: th.type,
    dataTypes: th.dataTypes,
    label: th.label,
    order: th.order,
    nodeId: nodeId,
    required: th.required || false,
    templateHandleId: th.id
  });
});

return { nodes, edges, handles };
\`\`\`

**Connect two nodes:**
\`\`\`javascript
const sourceHandle = handles.find(h => h.nodeId === sourceNodeId && h.type === 'Output');
const targetHandle = handles.find(h => h.nodeId === targetNodeId && h.type === 'Input');

edges.push({
  id: generateId(),
  source: sourceNodeId,
  target: targetNodeId,
  sourceHandleId: sourceHandle.id,
  targetHandleId: targetHandle.id
});

return { nodes, edges, handles };
\`\`\`

Be thorough and precise. Always validate your code logic before executing.`;

	return new Agent({
		name: "Canvas_Patcher",
		model: getAgentModel("gemini-2.5-pro"),
		instructions: systemPrompt,
		tools: [prepareCanvasTool, executeCanvasCodeTool, submitPatchTool],
	}).asTool({
		toolName: "modify_canvas",
		toolDescription: `Modify the canvas workflow by invoking the Patcher sub-agent.

This tool will:
1. Fetch current canvas state and available templates
2. Run a specialized agent that writes code to transform the state
3. Validate the changes and create a patch for user review

Use this for ALL canvas modifications: adding nodes, connecting edges, updating configs, etc.

IMPORTANT: You must include the canvasId and agentSessionId in your description so the sub-agent can access the canvas.
Format: "canvasId: <id>, agentSessionId: <id>. Task: <your description>"`,
	});
}

// Export for backwards compatibility (can be removed later)
export const invokePatcherTool = tool({
	name: "modify_canvas_legacy",
	description: "Legacy - use createPatcherAgent().asTool() instead",
	parameters: z.object({ msg: z.string() }),
	async execute() {
		return "This tool is deprecated. Use the new patcher agent tool.";
	},
});
