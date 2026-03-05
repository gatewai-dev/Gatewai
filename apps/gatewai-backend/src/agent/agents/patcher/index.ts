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
import {
	PATCHER_HELPER_API_DOCS,
	PATCHER_HELPERS_CODE,
} from "./patcher-helpers.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatcherContext {
	canvasId: string;
	agentSessionId: string;
	nodes: BulkUpdatePayload["nodes"];
	edges: BulkUpdatePayload["edges"];
	handles: BulkUpdatePayload["handles"];
	templates: NodeTemplate[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum wall-clock time (ms) the QuickJS VM is allowed to run per invocation. */
const VM_EXECUTION_TIMEOUT_MS = 15_000;

/** Maximum number of code-execution retries the agent is guided to attempt. */
const MAX_RETRIES = 4;

// ─── Context Store ────────────────────────────────────────────────────────────

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

// ─── VM Execution ─────────────────────────────────────────────────────────────

/**
 * Run `code` inside a QuickJS sandbox with injected canvas state and the
 * patcher helper library pre-loaded as a preamble.
 * Returns `{ nodes, edges, handles }` on success, or throws on error.
 */
async function runInVM(
	code: string,
	ctx: PatcherContext,
): Promise<{ nodes: unknown[]; edges: unknown[]; handles: unknown[] }> {
	const result = await runInSandbox<Record<string, unknown>>({
		// Helpers are injected first so every helper function is in scope
		// when the agent's code runs — identical pattern to SVG preamble.
		preamble: PATCHER_HELPERS_CODE,
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

## Available globals (direct access — no imports)
- \`nodes\`        Array of current Node objects (mutable)
- \`edges\`        Array of current Edge objects (mutable)
- \`handles\`      Array of current Handle objects (mutable)
- \`templates\`    Array of NodeTemplate objects (read-only)
- \`generateId()\` Returns a "temp-<uuid>" — use for ALL new IDs

## Helper library (pre-loaded — all functions are already in scope)
${PATCHER_HELPER_API_DOCS}

## Required return
Your code MUST end with: \`return { nodes, edges, handles };\`

## Key rules (validation auto-fails on violation)
1. Always use helper functions — raw array pushes are for edge cases only.
2. Edges connect Output → Input handles only.
3. Each Input handle supports at most ONE incoming edge.
4. No circular dependencies or self-loops.
5. Compositor layerUpdates keys MUST be the actual Input Handle ID (use setCompositorLayer).
6. VideoGen accepts at most 3 image inputs.

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
					"Read the error — it will tell you exactly what is wrong.",
					"Common causes:",
					"  • Wrong handle type passed to connectHandles() — check Output vs Input.",
					"  • Occupied Input handle — use tryConnect() to debug or pick a different target.",
					"  • Incompatible dataTypes — helper error message lists both sides.",
					"  • Missing return { nodes, edges, handles } at end of code.",
					"",
					"Fix the code and retry.",
				].join("\n");
			}
		},
	});

	// ── Tool: submit_patch ────────────────────────────────────────────────────
	const submitPatchTool = tool({
		name: "submit_patch",
		description:
			"Submit the validated canvas state as a patch for user review. Only call this after execute_canvas_code succeeds.",
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
2. Analyse the returned canvas state and plan your changes.
3. Call \`execute_canvas_code\` with your JavaScript.
4. If validation fails, read the error and fix **only** the reported issues. Retry up to ${MAX_RETRIES} times total.
5. Once execution succeeds, call \`submit_patch\` — no arguments needed.

## Helper Library
A set of helper functions is **pre-loaded in the VM** — you do not need to define them.
Always prefer helpers over raw array manipulation; they encode every hard rule automatically.

${PATCHER_HELPER_API_DOCS}

## Hard Rules (automatic validation failure if violated)
| Rule | Detail |
|---|---|
| IDs | Always use \`generateId()\`. Never hardcode strings. |
| Handle direction | \`connectHandles\` / \`connect\` enforce Output→Input automatically. |
| Data types | Helpers check compatibility and throw on mismatch. |
| Input occupancy | Each Input handle supports at most ONE incoming edge. Helpers enforce this. |
| No cycles | No circular dependency chains. |
| No self-loops | Helpers throw on same-node connections. |
| Compositor config | Use \`setCompositorLayer(node.id, inputHandle, config)\` — never set layerUpdates keys manually. |
| VideoCompositor | Terminal node — has NO Output handles. |
| VideoGen | At most 3 image reference inputs. |

## Layout
- Default node width: 340 px
- Use \`nextPosition(referenceNodeId, 'right')\` to place nodes beside existing ones.
- Use \`autoLayout(nodeIds)\` to arrange a batch of new nodes.
- Avoid overlapping existing nodes.

## Typical Patterns

### Add a single node and connect it
\`\`\`javascript
// Step 1 — inspect what's already on canvas (optional, helpful)
inspectCanvas();

// Step 2 — create the new node
const { node: textNode, outputHandles } = createNode({
  type: 'Text',
  name: 'Intro Text',
  position: { x: 100, y: 200 },
  config: { content: 'Hello world' },
});

// Step 3 — find the existing downstream node and connect
const downstream = findNodeByName('Video Generator');
connect(textNode.id, downstream.id); // auto-resolves first Output → first Input

return { nodes, edges, handles };
\`\`\`

### Build a multi-node pipeline from scratch
\`\`\`javascript
const { node: src, outputHandles: [srcOut] } = createNode({ type: 'ImageSource', name: 'BG Image', position: { x: 100, y: 200 } });
const { node: gen } = createNode({ type: 'VideoGen', name: 'Generator', position: nextPosition(src.id) });
const { node: comp, inputHandles: compInputs } = createCompositorNode({
  type: 'VideoCompositor',
  name: 'Final',
  position: nextPosition(gen.id),
  layers: [{ handleIndex: 0, config: { opacity: 1, blendingMode: 'normal' } }],
});

connect(src.id, gen.id);
connect(gen.id, comp.id);

return { nodes, edges, handles };
\`\`\`

### Modify an existing node
\`\`\`javascript
const node = findNodeByName('Intro Text');
updateNodeConfig(node.id, { content: 'Updated copy' });
return { nodes, edges, handles };
\`\`\`

### Remove a node and rewire
\`\`\`javascript
const old = findNodeByName('Old Filter');
const upstream = findNodesByType('ImageSource')[0];
const downstream = findNodeByName('Compositor');

removeNode(old.id); // also removes its edges
connect(upstream.id, downstream.id);

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
