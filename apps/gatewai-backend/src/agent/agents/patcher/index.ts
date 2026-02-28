/** biome-ignore-all lint/suspicious/noExplicitAny: Can't type cast unknown value from quickjs output */

import { runInSandbox } from "@gatewai/ai-agent";
import { logger } from "@gatewai/core";
import {
	agentBulkUpdateSchema,
	type BulkUpdatePayload,
} from "@gatewai/core/types";
import { GetCanvasEntities } from "@gatewai/data-ops";
import { type NodeTemplate, prisma } from "@gatewai/db";
import { Agent, type MCPServerStreamableHttp, tool } from "@openai/agents";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
	type AVAILABLE_AGENT_MODELS,
	getAgentModel,
} from "../../agent-model.js";

interface PatcherContext {
	canvasId: string;
	agentSessionId: string;
	nodes: BulkUpdatePayload["nodes"];
	edges: BulkUpdatePayload["edges"];
	handles: BulkUpdatePayload["handles"];
	templates: NodeTemplate[];
}

/** Maximum wall-clock time (ms) the QuickJS VM is allowed to run per invocation. */
const VM_EXECUTION_TIMEOUT_MS = 10_000;

/** Maximum number of code-execution retries the agent is guided to attempt. */
const MAX_RETRIES = 3;

/**
 * Keyed by `${canvasId}:${agentSessionId}` so concurrent agent runs for
 * different sessions never share or corrupt each other's canvas state.
 */
const contextStore = new Map<string, PatcherContext>();

function contextKey(canvasId: string, agentSessionId: string): string {
	return `${canvasId}:${agentSessionId}`;
}

function getContext(
	canvasId: string,
	agentSessionId: string,
): PatcherContext | undefined {
	return contextStore.get(contextKey(canvasId, agentSessionId));
}

function setContext(ctx: PatcherContext): void {
	contextStore.set(contextKey(ctx.canvasId, ctx.agentSessionId), ctx);
}

function clearContext(canvasId: string, agentSessionId: string): void {
	contextStore.delete(contextKey(canvasId, agentSessionId));
}

/**
 * Run `code` inside a QuickJS sandbox with injected canvas state.
 * Returns `{ nodes, edges, handles }` on success, or throws on error.
 */
async function runInVM(
	code: string,
	ctx: PatcherContext,
): Promise<{ nodes: unknown[]; edges: unknown[]; handles: unknown[] }> {
	const result = await runInSandbox<Record<string, unknown>>({
		code,
		globals: {
			nodes: ctx.nodes,
			edges: ctx.edges,
			handles: ctx.handles,
			templates: ctx.templates,
		},
		functions: {
			generateId: () => `temp-${crypto.randomUUID()}`,
		},
		timeoutMs: VM_EXECUTION_TIMEOUT_MS,
	});

	if (!result || typeof result !== "object") {
		throw new Error(
			"Code must return an object: { nodes: [...], edges: [...], handles: [...] }",
		);
	}

	const { nodes, edges, handles } = result;
	if (!Array.isArray(nodes)) throw new Error("result.nodes must be an array");
	if (!Array.isArray(edges)) throw new Error("result.edges must be an array");
	if (!Array.isArray(handles))
		throw new Error("result.handles must be an array");

	return { nodes, edges, handles };
}

// ─── Patcher Agent Factory ────────────────────────────────────────────────────

/**
 * Creates the Canvas Patcher sub-agent as an OpenAI Agents SDK tool.
 *
 * KEY DESIGN: `canvasId` and `agentSessionId` are injected by the orchestrator
 * and captured in the closure. The LLM sub-agent NEVER needs to parse or pass
 * these values — removing the #1 source of "Canvas not found" errors where the
 * model would hallucinate or misextract IDs from the task description string.
 */
export function createPatcherAgent(
	modelName: (typeof AVAILABLE_AGENT_MODELS)[number],
	mcpTool: MCPServerStreamableHttp,
	canvasId: string,
	agentSessionId: string,
) {
	// ── Tool: prepare_canvas ──────────────────────────────────────────────────
	const prepareCanvasTool = tool({
		name: "prepare_canvas",
		description:
			"Fetch the current canvas state and available node templates. Call this FIRST before execute_canvas_code.",
		// No ID params — canvasId and agentSessionId are captured from the closure.
		// This prevents the model from ever supplying wrong/hallucinated IDs.
		parameters: z.object({}),
		async execute() {
			try {
				const [{ nodes, edges, handles }, templates] = await Promise.all([
					GetCanvasEntities(canvasId),
					prisma.nodeTemplate.findMany({ include: { templateHandles: true } }),
				]);

				const sanitizedNodes =
					nodes?.map((node) => ({
						...node,
						type: node.type as any,
						width: node.width ?? 340,
					})) ?? [];

				setContext({
					canvasId,
					agentSessionId,
					nodes: sanitizedNodes,
					edges: edges ?? [],
					handles: handles ?? [],
					templates,
				});

				return [
					"Canvas prepared successfully:",
					`  • ${sanitizedNodes.length} existing nodes`,
					`  • ${(edges ?? []).length} existing edges`,
					`  • ${(handles ?? []).length} existing handles`,
					`  • ${templates.length} available templates`,
					"",
					"Available templates:",
					JSON.stringify(templates, null, 2),
					"",
					`You may now call execute_canvas_code. You have up to ${MAX_RETRIES} attempts if code fails.`,
				].join("\n");
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				logger.error(
					`[Patcher] prepare_canvas failed for canvas ${canvasId}: ${msg}`,
				);
				return `Failed to prepare canvas: ${msg}`;
			}
		},
	});

	// ── Tool: execute_canvas_code ─────────────────────────────────────────────
	const executeCanvasCodeTool = tool({
		name: "execute_canvas_code",
		description: `Execute JavaScript code to transform the canvas state inside a sandboxed VM.

Available globals:
- nodes        - Array of current Node objects (mutable)
- edges        - Array of current Edge objects (mutable)
- handles      - Array of current Handle objects (mutable)
- templates    - Array of NodeTemplate objects (read-only)
- generateId() - Returns a "temp-<uuid>" string; use for ALL new IDs
- console.log  - For debugging

Your code MUST return { nodes, edges, handles }.

RULES (automatic validation failure if violated):
1. Use generateId() for every new Node, Handle, and Edge ID.
2. Copy dataTypes, label, type, order, and required EXACTLY from template.templateHandles.
3. Edges connect an Output handle (sourceHandleId) to an Input handle (targetHandleId).
4. Each Input handle supports at most ONE incoming edge.
5. No circular dependencies or self-loops.
6. Compositor layerUpdates keys MUST be the actual Input Handle ID, not the label.
7. VideoCompositor has no Output handles.
8. VideoGen accepts at most 3 image inputs.

If validation fails, read the error carefully and fix only the reported issues.
You have ${MAX_RETRIES} attempts total.`,
		parameters: z.object({
			code: z
				.string()
				.describe(
					"JavaScript code that transforms the canvas state and returns { nodes, edges, handles }",
				),
		}),
		async execute({ code }) {
			// canvasId and agentSessionId come from the closure — safe, no parsing needed
			const ctx = getContext(canvasId, agentSessionId);
			if (!ctx) {
				return "Error: Canvas not prepared. Call prepare_canvas first.";
			}

			logger.info(`[Patcher] execute_canvas_code for canvas ${canvasId}`);

			try {
				const { nodes, edges, handles } = await runInVM(code, ctx);

				// Validate node types against templates
				const validTypes = new Set(ctx.templates.map((t) => t.type));
				const invalidNodes = (nodes as any[]).filter(
					(n) => !validTypes.has(n.type),
				);
				if (invalidNodes.length > 0) {
					const badTypes = [
						...new Set(invalidNodes.map((n: any) => n.type)),
					].join(", ");
					return [
						`Validation failed: Unknown node type(s): [${badTypes}]`,
						`Available types: [${[...validTypes].sort().join(", ")}]`,
						"Fix the node type and retry.",
					].join("\n");
				}

				// Validate against full schema
				const payload: BulkUpdatePayload = {
					nodes: nodes as any,
					edges: edges as any,
					handles: handles as any,
				};

				const validation = agentBulkUpdateSchema.safeParse(payload);
				if (!validation.success) {
					const errors = validation.error.issues.map((issue) => {
						const path = issue.path.join(".") || "(root)";
						return `  • ${path}: ${issue.message}`;
					});
					return [
						`Validation failed (${validation.error.issues.length} issue(s)):`,
						...errors,
						"",
						"Fix only the issues listed above and retry with corrected code.",
					].join("\n");
				}

				// Commit validated state
				ctx.nodes = validation.data.nodes ?? [];
				ctx.edges = validation.data.edges ?? [];
				ctx.handles = validation.data.handles ?? [];
				setContext(ctx);

				return [
					"Code executed and validated successfully:",
					`  • ${ctx.nodes.length} nodes`,
					`  • ${ctx.edges.length} edges`,
					`  • ${ctx.handles.length} handles`,
					"",
					"Call submit_patch to create the patch proposal.",
				].join("\n");
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				logger.error(
					`[Patcher] execute_canvas_code error for canvas ${canvasId}: ${msg}`,
				);
				return [
					`Code execution failed: ${msg}`,
					"",
					"Common causes:",
					"  • Syntax error — check for missing brackets or semicolons.",
					"  • Using a handle label as a layerUpdates key — use the handle's ID instead.",
					"  • Connecting incompatible dataTypes — check source and target handle dataTypes.",
					"  • Adding an edge to an already-occupied Input handle.",
					"",
					"Fix the code and retry (make sure to return { nodes, edges, handles }).",
				].join("\n");
			}
		},
	});

	// ── Tool: submit_patch ────────────────────────────────────────────────────
	const submitPatchTool = tool({
		name: "submit_patch",
		description:
			"Submit the validated canvas state as a patch for user review. Only call this after execute_canvas_code succeeds.",
		// No ID params — captured from closure; model cannot supply wrong values
		parameters: z.object({}),
		async execute() {
			const ctx = getContext(canvasId, agentSessionId);
			if (!ctx) {
				return "Error: No prepared context found. Call prepare_canvas first.";
			}

			const payload: BulkUpdatePayload = {
				nodes: ctx.nodes,
				edges: ctx.edges,
				handles: ctx.handles,
			};

			try {
				const result = await mcpTool.callTool("propose-canvas-update", {
					canvasId: ctx.canvasId,
					agentSessionId: ctx.agentSessionId,
					canvasState: payload,
				});

				// Clear only after confirmed success
				clearContext(canvasId, agentSessionId);

				const resultText =
					Array.isArray((result as any)?.content) &&
					(result as any).content.find((c: any) => c.type === "text")?.text;

				return `Patch submitted for canvas ${canvasId}. ${resultText ?? "The user has been notified to review the changes."}`;
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				logger.error(
					`[Patcher] submit_patch failed for canvas ${canvasId}: ${msg}`,
				);
				// Do NOT clear context — allow retry
				return [
					`Failed to submit patch: ${msg}`,
					"The canvas state is still available. You may retry submit_patch.",
				].join("\n");
			}
		},
	});

	// ── Schema reference for system prompt ───────────────────────────────────
	const jsonSchema = zodToJsonSchema(agentBulkUpdateSchema, {
		name: "bulkUpdateSchema",
	});
	const schemaString = JSON.stringify(jsonSchema, null, 2);

	// ── System Prompt ────────────────────────────────────────────────────────
	const systemPrompt = `You are the Canvas Patcher Agent. Your sole job is to write correct JavaScript that transforms canvas state, then submit the result.

## Workflow (follow exactly in order)
1. Call \`prepare_canvas\` — no arguments needed.
2. Analyse the returned state and plan your changes based on the task description.
3. Call \`execute_canvas_code\` with your JavaScript.
4. If validation fails, read the error carefully and fix **only** the reported issues. Retry up to ${MAX_RETRIES} times total.
5. Once execution succeeds, call \`submit_patch\` — no arguments needed.

## Hard Rules (automatic validation failure if violated)
| Rule | Detail |
|---|---|
| IDs | Always use \`generateId()\`. Never hardcode strings. |
| Handle type | Input handles → type "Input". Output handles → type "Output". |
| Data types | Edges only connect handles sharing ≥1 common dataType. |
| Input occupancy | Each Input handle supports at most ONE incoming edge. Check before adding. |
| No cycles | No circular dependency chains. |
| No self-loops | A node cannot connect to itself. |
| Compositor config | \`layerUpdates\` keys must be the **Handle ID**, not the handle label. |
| VideoCompositor | Terminal node — has NO Output handles. |
| VideoGen | At most 3 image reference inputs. |

## Layout
- Default node width: 340 px
- Horizontal spacing: 500 px (position-to-position)
- Vertical spacing: 400 px
- Avoid overlapping existing nodes

## How to Create a Node
\`\`\`javascript
const nodeId = generateId();
const template = templates.find(t => t.type === 'Text');

nodes.push({
  id: nodeId,
  name: 'My Node',
  type: template.type,
  templateId: template.id,
  position: { x: 100, y: 100 },
  width: 340,
  config: { content: 'Hello' }
});

template.templateHandles.forEach((th) => {
  handles.push({
    id: generateId(),
    type: th.type,           // 'Input' or 'Output' — copy exactly
    dataTypes: th.dataTypes, // copy exactly
    label: th.label,         // copy exactly
    order: th.order,
    nodeId: nodeId,
    required: th.required ?? false,
    templateHandleId: th.id,
  });
});

return { nodes, edges, handles };
\`\`\`

## How to Connect Two Nodes Safely
\`\`\`javascript
const sourceHandle = handles.find(h => h.nodeId === sourceNodeId && h.type === 'Output');
const targetHandle = handles.find(h => h.nodeId === targetNodeId && h.type === 'Input');

if (sourceHandle && targetHandle) {
  const typesCompatible = sourceHandle.dataTypes.some(dt => targetHandle.dataTypes.includes(dt));
  const inputFree = !edges.some(e => e.targetHandleId === targetHandle.id);

  if (typesCompatible && inputFree) {
    edges.push({
      id: generateId(),
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandleId: sourceHandle.id,
      targetHandleId: targetHandle.id,
    });
  } else {
    console.log('Skipping edge: incompatible types or occupied input');
  }
}

return { nodes, edges, handles };
\`\`\`

## How to Configure a Compositor Node
\`\`\`javascript
const nodeId = generateId();
const template = templates.find(t => t.type === 'Compositor');
const inputHandleIds = [];

nodes.push({
  id: nodeId,
  name: 'Combiner',
  type: template.type,
  templateId: template.id,
  position: { x: 800, y: 200 },
  width: 340,
  config: { layerUpdates: {} },
});

template.templateHandles.forEach((th) => {
  const hId = generateId();
  handles.push({ id: hId, type: th.type, dataTypes: th.dataTypes, label: th.label, order: th.order, nodeId, required: th.required ?? false, templateHandleId: th.id });
  if (th.type === 'Input') inputHandleIds.push(hId);
});

// IMPORTANT: keys are Handle IDs, NOT handle labels
const nodeRef = nodes.find(n => n.id === nodeId);
nodeRef.config = {
  layerUpdates: {
    [inputHandleIds[0]]: { opacity: 1.0, blendingMode: 'normal' },
  },
};

return { nodes, edges, handles };
\`\`\`

## Validation Schema Reference
\`\`\`json
${schemaString}
\`\`\`
`;

	return new Agent({
		name: "Canvas_Patcher",
		model: getAgentModel(modelName),
		instructions: systemPrompt,
		toolUseBehavior: { stopAtToolNames: ["submit_patch"] },
		tools: [prepareCanvasTool, executeCanvasCodeTool, submitPatchTool],
	}).asTool({
		toolName: "modify_canvas",
		toolDescription: `Modify the canvas workflow by invoking the Canvas Patcher sub-agent.

The sub-agent will:
1. Fetch the current canvas state and available templates.
2. Write and execute JavaScript to transform the canvas.
3. Validate the result and create a patch for user review.

Provide a detailed task description of every change to make:
- Nodes to add (type, name, position, config)
- Edges to create (source node + handle → target node + handle)
- Existing entities to modify (what to change and the new value)`,
	});
}
