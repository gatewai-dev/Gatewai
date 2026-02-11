import assert from "node:assert";
import { logger } from "@gatewai/core";
import {
	agentBulkUpdateSchema,
	type BulkUpdatePayload,
} from "@gatewai/core/types";
import { GetCanvasEntities } from "@gatewai/data-ops";
import { type NodeTemplate, prisma } from "@gatewai/db";
import { Agent, type MCPServerStreamableHttp, tool } from "@openai/agents";
import { getQuickJS, type QuickJSContext, Scope } from "quickjs-emscripten";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
	type AVAILABLE_AGENT_MODELS,
	getAgentModel,
} from "../../agent-model.js";

/**
 * Patcher Sub-Agent
 *
 * This agent writes JavaScript code to manipulate canvas state.
 * It uses quickjs-ecmascripten to execute the code safely, validates the result,
 * and retries if the code fails or validation errors occur.
 *
 * Flow:
 * 1. Orchestrator calls this subagent via .asTool() handoff
 * 2. Subagent calls prepare_canvas to fetch state
 * 3. Subagent writes JS code to modify canvas state
 * 4. Code is executed in QuickJS sandbox
 * 5. Result is validated against bulkUpdateSchema
 * 6. On success, submit_patch creates the patch via MCP
 * 7. On failure, agent retries with error context
 */

// Shared context between tool calls within a single agent run
interface PatcherContext {
	canvasId: string;
	agentSessionId: string;
	nodes: BulkUpdatePayload["nodes"];
	edges: BulkUpdatePayload["edges"];
	handles: BulkUpdatePayload["handles"];
	templates: NodeTemplate[];
}

/**
 * Create the Patcher Sub-Agent as a Tool
 */
export function createPatcherAgent(
	modelName: (typeof AVAILABLE_AGENT_MODELS)[number],
	mcpTool: MCPServerStreamableHttp,
) {
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

				const sanitizedNodes =
					nodes?.map((node) => ({
						...node,
						type: node.type as any,
						width: node.width ?? 340,
					})) || [];

				// Store in context for other tools
				patcherContext = {
					canvasId,
					agentSessionId,
					nodes: sanitizedNodes,
					edges: edges || [],
					handles: handles || [],
					templates,
				};

				return `Canvas prepared successfully!
		- ${sanitizedNodes.length} existing nodes
		- ${(edges || []).length} existing edges
		- ${(handles || []).length} existing handles
		- ${templates.length} available templates
		
		Available templates:
		${JSON.stringify(templates)}
		
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
	 * Executes JavaScript code in a QuickJS sandbox to transform canvas state.
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
			logger.info("[VM] Context prepared. Starting execution.");

			// Use Scope for automatic handle disposal
			const scope = new Scope();
			let context: QuickJSContext | undefined;

			try {
				const QuickJS = await getQuickJS();
				context = QuickJS.newContext();
				assert(context);
				const undefinedHandle = scope.manage(context.undefined);

				// Helper: Inject JSON data into VM global scope
				logger.info("[VM] Preparing to inject globals");

				const injectGlobal = (name: string, data: any) => {
					assert(context);
					const jsonStr = JSON.stringify(data);
					const jsonHandle = scope.manage(context.newString(jsonStr));

					// Use JSON.parse inside VM to create the object
					const parseResult = context.evalCode(`JSON.parse`);
					if (parseResult.error) {
						const error = scope.manage(parseResult.error);
						const errorDump = context.dump(error);
						console.error("[VM] JSON.parse lookup error:", errorDump);
						// We don't really need to read the error for JSON.parse lookup failure, but good practice
						throw new Error(`Failed to access JSON.parse in VM`);
					}
					const parseFn = scope.manage(context.unwrapResult(parseResult));

					const objHandle = scope.manage(
						context.unwrapResult(
							context.callFunction(parseFn, undefinedHandle, jsonHandle),
						),
					);

					context.setProp(context.global, name, objHandle);
				};

				// 1. Inject Context Data
				injectGlobal("nodes", patcherContext.nodes);
				injectGlobal("edges", patcherContext.edges);
				injectGlobal("handles", patcherContext.handles);
				injectGlobal("templates", patcherContext.templates);

				// 2. Inject generateId helper
				const generateIdHandle = scope.manage(
					context.newFunction("generateId", () => {
						const id = `temp-${crypto.randomUUID()}`;
						assert(context);
						return context.newString(id); // NOTE: Return values from host functions are owned by VM, not Scope
					}),
				);
				context.setProp(context.global, "generateId", generateIdHandle);

				// 3. Inject console.log helper (for debugging within VM if needed)
				const consoleHandle = scope.manage(context.newObject());
				const logHandle = scope.manage(
					context.newFunction("log", (...args: any[]) => {
						const logArgs = args.map((arg) => {
							assert(context);
							return context.dump(arg);
						});
						console.log("[VM]", ...logArgs);
					}),
				);
				context.setProp(consoleHandle, "log", logHandle);
				context.setProp(context.global, "console", consoleHandle);

				// 4. Execute the user code
				// We wrap it in an IIFE to ensure we capture the return value
				const wrappedCode = `
					(function() {
						${code}
					})()
				`;

				const resultHandle = context.evalCode(wrappedCode);

				if (resultHandle.error) {
					const errorHandle = scope.manage(resultHandle.error);
					const error = context.dump(errorHandle);
					console.error("[VM] Execution error dump:", error);

					let errorMsg = String(error);
					if (typeof error === "object" && error !== null) {
						const name = (error as any).name || "Error";
						const message = (error as any).message || JSON.stringify(error);
						const stack = (error as any).stack || "";
						errorMsg = `${name}: ${message}\n${stack}`;
					}
					throw new Error(errorMsg);
				}

				const valueHandle = scope.manage(resultHandle.value);
				const result = context.dump(valueHandle);
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

				const validationResult = agentBulkUpdateSchema.safeParse(payload);
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
				console.error("[VM] Top-level execution error:", msg);
				return `Code execution failed: ${msg}\n\nFix the code and try again.`;
			} finally {
				// Dispose scope handles first
				scope.dispose();

				// Then dispose the runtime
				if (context) {
					context.dispose();
				}
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
				const result = await mcpTool.callTool("propose-canvas-update", {
					canvasId: patcherContext.canvasId,
					agentSessionId: patcherContext.agentSessionId,
					canvasState: payload,
				});

				// Clear context after successful submission
				const canvasId = patcherContext.canvasId;
				patcherContext = null;

				const resultText =
					Array.isArray((result as any)?.content) &&
					(result as any).content.find((c: any) => c.type === "text")?.text;

				return `Patch submitted successfully for canvas ${canvasId}! ${resultText || "The user has been notified to review the changes."} `;
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				return `Failed to submit patch: ${msg} `;
			}
		},
	});

	// Generate JSON schema for validation reference
	const jsonSchema = zodToJsonSchema(agentBulkUpdateSchema, {
		name: "bulkUpdateSchema",
	});
	const schemaString = JSON.stringify(jsonSchema, null, 2);

	const systemPrompt = `You are a Canvas Patcher Agent. Your job is to write JavaScript code that transforms canvas state with precision.
You are executing in a sandboxed QuickJS environment.

## Your Workflow
1. **Analyze**: Read the task and the current canvas state.
2. **Plan**: Decide which nodes to add, remove, or modify.
3. **Write Code**: Use \`execute_canvas_code\` to apply changes.
4. **Verify**: Ensure your code returns the updated \`{ nodes, edges, handles }\` object.
5. **Submit**: Call \`submit_patch\` once validation passes.

## Critical Rules (Violating these causes automatic validation failure)
1. **IDs**: ALWAYS use \`generateId()\` for new Nodes, Handles, and Edges. Never hardcode strings.
2. **Handle Types**: Input handles must be Type "Input". Output handles must be Type "Output".
3. **Data Types**: Edges can only connect handles if they share a common dataType (e.g., both support "Image").
4. **Topology**:
   - **One Input Rule**: An "Input" handle can have AT MOST ONE incoming edge.
   - **No Cycles**: Do not create circular dependencies.
   - **No Self-Loops**: A node cannot connect to itself.
5. **Compositor/VideoCompositor Configs**:
   - If configuring \`layerUpdates\`, the KEYS of the object MUST be the valid **ID of the Input Handle**, not the handle name or label.
   - Example: \`config: { layerUpdates: { [handleId]: { opacity: 0.5 } } }\`
6. **VideoCompositor**: This node CANNOT have Output handles. It is a terminal node.
7. **VideoGen**: Maximum 3 image inputs allowed.

## Layout & Positioning
- New nodes should be positioned to avoid overlapping existing nodes.
- Default spacing: 500px horizontal, 400px vertical.
- Default width: 340px.

## Global Variables Available in \`execute_canvas_code\`
- \`nodes\`: Array of Node objects.
- \`edges\`: Array of Edge objects.
- \`handles\`: Array of Handle objects.
- \`templates\`: Array of NodeTemplate objects (contains \`templateHandles\`).
- \`generateId()\`: Function to create UUIDs.
- \`console.log(...args)\`: For debugging.

## How to Create a Node Correctly
1. **Find Template**: \`const t = templates.find(t => t.type === 'MyType');\`
2. **Create Node**: Push to \`nodes\` array. Use \`templateId: t.id\`.
3. **Create Handles**: Iterate \`t.templateHandles\`. Create a NEW handle for each, copying \`dataTypes\`, \`label\`, \`type\`, and \`required\`. **Set \`nodeId\` to the new node's ID.**
4. **Connect**: Find source/target handles in the \`handles\` array by \`nodeId\` and \`type\`.

## Validation Schema Reference
Your output must strictly adhere to this schema. Pay close attention to \`config\` objects.

\`\`\`json
${schemaString}
\`\`\`

## Code Examples

### 1. Adding a Compositor Node (Advanced Config)
\`\`\`javascript
const nodeId = generateId();
const template = templates.find(t => t.type === 'Compositor');

// 1. Create Node
nodes.push({
  id: nodeId,
  name: 'Combiner',
  type: 'Compositor',
  templateId: template.id,
  position: { x: 800, y: 200 },
  width: 340,
  config: { layerUpdates: {} } // Initialize empty
});

// 2. Create Handles & Track IDs for Config
const inputHandleIds = [];
template.templateHandles.forEach((th) => {
  const hId = generateId();
  handles.push({
    id: hId,
    type: th.type, // 'Input' or 'Output'
    dataTypes: th.dataTypes,
    label: th.label,
    order: th.order,
    nodeId: nodeId,
    required: th.required || false,
    templateHandleId: th.id
  });
  
  if (th.type === 'Input') inputHandleIds.push(hId);
});

// 3. Update Config (using Handle IDs as keys)
const nodeIndex = nodes.findIndex(n => n.id === nodeId);
if (inputHandleIds.length > 0) {
  // Example: Set first layer opacity to 1
  nodes[nodeIndex].config = {
    layerUpdates: {
       [inputHandleIds[0]]: { opacity: 1.0, blendingMode: 'normal' }
    }
  };
}

return { nodes, edges, handles };
\`\`\`

### 2. Connecting Two Nodes Safely
\`\`\`javascript
// Assume sourceNodeId and targetNodeId exist
const sourceHandle = handles.find(h => h.nodeId === sourceNodeId && h.type === 'Output');
const targetHandle = handles.find(h => h.nodeId === targetNodeId && h.type === 'Input');

if (sourceHandle && targetHandle) {
  // CHECK: Data Type Compatibility
  const hasCommonType = sourceHandle.dataTypes.some(dt => targetHandle.dataTypes.includes(dt));
  
  // CHECK: Target Input Availability (Max 1 edge per input)
  const isOccupied = edges.some(e => e.targetHandleId === targetHandle.id);
  
  if (hasCommonType && !isOccupied) {
    edges.push({
      id: generateId(),
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandleId: sourceHandle.id,
      targetHandleId: targetHandle.id
    });
  } else {
    console.log("Cannot connect: Incompatible types or input occupied");
  }
}

return { nodes, edges, handles };
\`\`\`

Always validate your logic. If you manipulate \`config\`, verify keys are valid handle IDs.`;

	return new Agent({
		name: "Canvas_Patcher",
		model: getAgentModel(modelName),
		instructions: systemPrompt,
		toolUseBehavior: { stopAtToolNames: ["submit_patch"] },
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
