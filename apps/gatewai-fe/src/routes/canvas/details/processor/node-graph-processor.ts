import { EventEmitter } from "node:events";
import type { DataType, NodeType } from "@gatewai/db";
import type {
	CropNodeConfig,
	FileData,
	NodeResult,
	PaintNodeConfig,
	PaintResult,
	ResizeNodeConfig,
} from "@gatewai/types";
import type { EdgeEntityType } from "@/store/edges";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { pixiProcessor } from "./pixi-service";

interface ProcessorConfig {
	nodes: Map<string, NodeEntityType>;
	edges: EdgeEntityType[];
	handles: HandleEntityType[];
}

interface NodeState {
	id: string;
	isDirty: boolean;
	isProcessing: boolean;
	result: NodeResult | null;
	error: string | null;
	abortController: AbortController | null;
	/** Tracks the configuration signature processed to detect changes */
	lastProcessedSignature: string | null;
}

type NodeProcessorParams = {
	node: NodeEntityType;
	inputs: Map<string, NodeResult>;
	signal: AbortSignal;
};

type NodeProcessor = (
	params: NodeProcessorParams,
) => Promise<NodeResult | null>;

/**
 * Centralized graph processor - handles all node computation outside React lifecycle
 * Optimized for parallel execution and robust abort handling.
 */
export class NodeGraphProcessor extends EventEmitter {
	private nodes = new Map<string, NodeEntityType>();
	private edges: EdgeEntityType[] = [];
	private handles: HandleEntityType[] = [];

	// Adjacency lists for fast traversal (Adj: Parent -> Children, Rev: Child -> Parents)
	private adjacency = new Map<string, Set<string>>();
	private reverseAdjacency = new Map<string, Set<string>>();

	// State
	private nodeStates = new Map<string, NodeState>();
	private processors = new Map<string, NodeProcessor>();
	private processingLoopActive = false;
	private schedulePromise: Promise<void> | null = null;

	constructor() {
		super();
		this.setMaxListeners(Infinity);
		this.registerBuiltInProcessors();
	}

	// =========================================================================
	// Public API
	// =========================================================================

	/**
	 * Update graph structure from Redux store.
	 * Calculates diffs and triggers processing only for affected nodes.
	 */
	updateGraph(config: ProcessorConfig): void {
		const prevNodes = this.nodes;
		const prevEdges = this.edges;

		this.nodes = config.nodes;
		this.edges = config.edges;
		this.handles = config.handles;

		// 1. Rebuild Graph Topology (Fast)
		this.buildAdjacencyLists();

		// 2. Detect Changes
		const nodesToInvalidate = new Set<string>();

		// Check for node config changes
		this.nodes.forEach((node, id) => {
			const prev = prevNodes.get(id);

			// New node or config changed
			if (!prev || this.hasNodeConfigChanged(prev, node)) {
				nodesToInvalidate.add(id);
			}
		});

		// Check for input/edge changes
		const inputChanges = this.detectInputChanges(prevEdges, this.edges);
		inputChanges.forEach((nodeId) => {
			nodesToInvalidate.add(nodeId);
		});

		// 3. Cleanup deleted nodes
		prevNodes.forEach((_, id) => {
			if (!this.nodes.has(id)) {
				const state = this.nodeStates.get(id);
				state?.abortController?.abort();
				this.nodeStates.delete(id);
			}
		});

		// 4. Mark dirty and cascade
		if (nodesToInvalidate.size > 0) {
			this.markNodesDirty(Array.from(nodesToInvalidate));
		}
	}

	getNodeResult(nodeId: string): NodeResult | null {
		return this.nodeStates.get(nodeId)?.result ?? null;
	}

	getNodeState(nodeId: string): NodeState | null {
		return this.nodeStates.get(nodeId) ?? null;
	}

	async processNode(nodeId: string): Promise<void> {
		this.markNodesDirty([nodeId]);
		await this.triggerProcessing();
	}

	registerProcessor(nodeType: NodeType, processor: NodeProcessor): void {
		this.processors.set(nodeType, processor);
	}

	destroy(): void {
		this.nodeStates.forEach((state) => {
			state.abortController?.abort();
		});
		this.nodeStates.clear();
		this.removeAllListeners();
	}

	// =========================================================================
	// Core Processing Engine
	// =========================================================================

	private markNodesDirty(startNodeIds: string[]): void {
		const queue = [...startNodeIds];
		const visited = new Set<string>();

		while (queue.length > 0) {
			const nodeId = queue.shift();
			if (!nodeId) throw new Error("Queue emptied");
			if (visited.has(nodeId)) continue;
			visited.add(nodeId);

			const state = this.getOrCreateNodeState(nodeId);

			// Important: If currently processing, abort it.
			// We do NOT set isDirty = false. It remains true so the loop picks it up again.
			if (state.isProcessing && state.abortController) {
				state.abortController.abort("Restarting due to graph update");
				state.abortController = null;
			}

			state.isDirty = true;
			state.error = null;
			// Note: We don't clear state.result immediately to allow UI to show stale data
			// while reprocessing, but strictly speaking, it's invalid.
			// Depending on UX, you might want to set state.result = null here.

			// Add downstream nodes to queue
			const children = this.adjacency.get(nodeId);
			if (children) {
				children.forEach((childId) => {
					queue.push(childId);
				});
			}
		}

		this.triggerProcessing();
	}

	/**
	 * Debounced trigger for the processing loop.
	 */
	private async triggerProcessing(): Promise<void> {
		if (this.processingLoopActive) return;

		// Return existing promise if already scheduling, or create new
		if (!this.schedulePromise) {
			this.schedulePromise = Promise.resolve().then(() => {
				this.schedulePromise = null;
				return this.runProcessingLoop();
			});
		}
		return this.schedulePromise;
	}

	/**
	 * The main execution loop.
	 * Runs continuously as long as there are 'ready' nodes.
	 * Supports parallelism.
	 */
	private async runProcessingLoop(): Promise<void> {
		if (this.processingLoopActive) return;
		this.processingLoopActive = true;

		try {
			let hasWork = true;

			while (hasWork) {
				// 1. Identify all nodes that CAN run right now
				const readyNodes: string[] = [];
				const dirtyNodes = Array.from(this.nodeStates.values()).filter(
					(s) => s.isDirty,
				);

				if (dirtyNodes.length === 0) {
					hasWork = false;
					break;
				}

				let waitingCount = 0;

				for (const state of dirtyNodes) {
					if (state.isProcessing) continue; // Already running

					if (this.areInputsReady(state.id)) {
						readyNodes.push(state.id);
					} else {
						waitingCount++;
					}
				}

				// If no nodes are ready but we have dirty nodes, and nothing is currently processing,
				// we have a deadlock (cycle) or missing inputs.
				const processingCount = Array.from(this.nodeStates.values()).filter(
					(s) => s.isProcessing,
				).length;
				if (
					readyNodes.length === 0 &&
					waitingCount > 0 &&
					processingCount === 0
				) {
					console.error(
						"Graph deadlock detected: Cycles or missing upstream results.",
					);
					this.emit("graph:error", {
						message: "Dependency cycle or missing inputs detected",
					});
					hasWork = false;
					break;
				}

				if (readyNodes.length === 0 && processingCount > 0) {
					// Wait for current batch to finish before checking again
					// We can break the tight loop here; the 'finally' of a processor will trigger this loop again.
					// But since we are in a while loop, we simply await a race of current processors?
					// Simpler: Just break loop, and let the finishing promise trigger a re-check.
					hasWork = false;
					break;
				}

				// 2. Launch all ready nodes in parallel
				const executions = readyNodes.map((nodeId) => this.executeNode(nodeId));

				// Wait for THIS batch to complete (or at least one of them)
				// Actually, to maximize parallelism, we shouldn't await all.
				// However, awaiting all simplifies state management for this implementation.
				await Promise.all(executions);

				// Loop continues to check what unlocked
			}
		} finally {
			this.processingLoopActive = false;
			// Check if more work appeared while we were finishing
			const remainingDirty = Array.from(this.nodeStates.values()).some(
				(s) => s.isDirty && !s.isProcessing,
			);
			if (remainingDirty) {
				this.triggerProcessing();
			}
		}
	}

	private areInputsReady(nodeId: string): boolean {
		const parents = this.reverseAdjacency.get(nodeId);
		if (!parents || parents.size === 0) return true;

		for (const parentId of parents) {
			const parentState = this.nodeStates.get(parentId);
			// If parent has no result, or is dirty (needs update), we aren't ready
			if (!parentState?.result || parentState.isDirty) {
				return false;
			}
		}
		return true;
	}

	private async executeNode(nodeId: string): Promise<void> {
		const state = this.nodeStates.get(nodeId);
		if (!state) return;

		const node = this.nodes.get(nodeId);
		if (!node) return;

		const processor = this.processors.get(node.type);
		if (!processor) {
			state.error = `No processor found for type ${node.type}`;
			state.isDirty = false;
			this.emit("node:error", { nodeId, error: state.error });
			return;
		}

		// Setup Execution
		state.isProcessing = true;
		state.error = null;
		state.abortController = new AbortController();
		const signal = state.abortController.signal;

		try {
			const inputs = this.collectInputs(nodeId);
			this.emit("node:start", { nodeId });

			// EXECUTE
			const result = await processor({
				node,
				inputs,
				signal,
			});

			// If we are here, we finished successfully WITHOUT being aborted
			if (signal.aborted) {
				// This usually throws, but if a processor swallows abort, handle it here
				throw new Error("Aborted");
			}

			state.result = result;
			state.isDirty = false; // Clean!
			state.lastProcessedSignature = JSON.stringify(node.config); // Simple versioning

			this.emit("node:processed", { nodeId, result });
		} catch (error) {
			const isAbort =
				error instanceof Error &&
				(error.name === "AbortError" || error.message === "Aborted");

			if (isAbort) {
				// CRITICAL FIX:
				// If aborted, we check if it's still dirty.
				// If it is dirty, it means it was invalidated during the run (Restart).
				// If it's NOT dirty (rare manual abort), we leave it.
				// In our `markNodesDirty` logic, we keep isDirty=true.
				// So we simply do nothing here. The state remains isDirty=true,
				// and the main loop will pick it up again.
				state.isProcessing = false;
				state.abortController = null;
				return;
			}

			state.error = error instanceof Error ? error.message : "Unknown error";
			state.isDirty = false; // Stop trying if it's a real error
			this.emit("node:error", { nodeId, error: state.error });
		} finally {
			state.isProcessing = false;
			state.abortController = null;
		}
	}

	// =========================================================================
	// Helpers & Graph Logic
	// =========================================================================

	private getOrCreateNodeState(id: string): NodeState {
		let state = this.nodeStates.get(id);
		if (!state) {
			state = {
				id,
				isDirty: false,
				isProcessing: false,
				result: null,
				error: null,
				abortController: null,
				lastProcessedSignature: null,
			};
			this.nodeStates.set(id, state);
		}
		return state;
	}

	private buildAdjacencyLists() {
		this.adjacency.clear();
		this.reverseAdjacency.clear();

		this.nodes.forEach((_, id) => {
			this.adjacency.set(id, new Set());
			this.reverseAdjacency.set(id, new Set());
		});

		for (const edge of this.edges) {
			if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target))
				continue;

			this.adjacency.get(edge.source)?.add(edge.target);
			this.reverseAdjacency.get(edge.target)?.add(edge.source);
		}
	}

	private hasNodeConfigChanged(
		prev: NodeEntityType,
		curr: NodeEntityType,
	): boolean {
		// Deep comparison of config
		return JSON.stringify(prev.config) !== JSON.stringify(curr.config);
	}

	private detectInputChanges(
		prevEdges: EdgeEntityType[],
		currEdges: EdgeEntityType[],
	): Set<string> {
		const changedNodes = new Set<string>();

		// Build map "TargetNodeID -> Set<ConnectionSignature>"
		const getSig = (edges: EdgeEntityType[]) => {
			const map = new Map<string, Set<string>>();
			edges.forEach((e) => {
				if (!map.has(e.target)) map.set(e.target, new Set());
				// Signature: TargetHandle <- SourceNode:SourceHandle
				map
					.get(e.target)
					?.add(`${e.targetHandleId}|${e.source}|${e.sourceHandleId}`);
			});
			return map;
		};

		const prevMap = getSig(prevEdges);
		const currMap = getSig(currEdges);

		// Check for added/changed connections
		currMap.forEach((sigs, nodeId) => {
			const prevSigs = prevMap.get(nodeId);
			if (!prevSigs || prevSigs.size !== sigs.size) {
				changedNodes.add(nodeId);
			} else {
				for (const sig of sigs) {
					if (!prevSigs.has(sig)) {
						changedNodes.add(nodeId);
						break;
					}
				}
			}
		});

		// Check for removed connections (nodes that existed in prev but lost edges)
		prevMap.forEach((_, nodeId) => {
			if (!currMap.has(nodeId) && this.nodes.has(nodeId)) {
				changedNodes.add(nodeId);
			}
		});

		return changedNodes;
	}

	private collectInputs(nodeId: string): Map<string, NodeResult> {
		const inputs = new Map<string, NodeResult>();
		const parentIds = this.reverseAdjacency.get(nodeId);

		if (parentIds) {
			parentIds.forEach((parentId) => {
				const res = this.nodeStates.get(parentId)?.result;
				if (res) inputs.set(parentId, res);
			});
		}
		return inputs;
	}

	private registerBuiltInProcessors(): void {
		const extractImage = (
			inputs: Map<string, NodeResult>,
			nodeId: string,
			inputHandleId?: string,
		) => {
			if (!inputHandleId)
				throw new Error(`Node ${nodeId}: No input handle provided`);

			// Find connection
			const edge = this.edges.find(
				(e) => e.target === nodeId && e.targetHandleId === inputHandleId,
			);
			if (!edge) throw new Error(`Node ${nodeId}: Not connected`);

			const result = inputs.get(edge.source);
			if (!result)
				throw new Error(
					`Node ${nodeId}: Missing input data from ${edge.source}`,
				);

			const outputItem = result.outputs[
				result.selectedOutputIndex ?? 0
			]?.items.find((i) => i.outputHandleId === edge.sourceHandleId);

			const fileData = outputItem?.data as FileData;
			const url = fileData?.entity?.signedUrl ?? fileData?.dataUrl;

			if (!url) throw new Error(`Node ${nodeId}: No image data found`);
			return url;
		};

		const getFirstInputHandle = (nodeId: string) =>
			this.handles.find((h) => h.nodeId === nodeId && h.type === "Input")?.id;

		const getFirstOutputHandle = (nodeId: string, type: string = "Image") =>
			this.handles.find(
				(h) =>
					h.nodeId === nodeId &&
					h.type === "Output" &&
					h.dataTypes.includes(type as DataType),
			)?.id;

		// --- Processors ---

		this.registerProcessor("Crop", async ({ node, inputs, signal }) => {
			const inputHandle = getFirstInputHandle(node.id);
			const imageUrl = extractImage(inputs, node.id, inputHandle);
			const config = node.config as CropNodeConfig;

			const dataUrl = await pixiProcessor.processCrop(
				imageUrl,
				{
					leftPercentage: config.leftPercentage,
					topPercentage: config.topPercentage,
					widthPercentage: config.widthPercentage,
					heightPercentage: config.heightPercentage,
				},
				signal,
			);

			const outputHandle = getFirstOutputHandle(node.id);
			if (!outputHandle) throw new Error("Output handle missing");

			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: "Image",
								data: { dataUrl },
								outputHandleId: outputHandle,
							},
						],
					},
				],
			};
		});

		this.registerProcessor("Paint", async ({ node, inputs, signal }) => {
			const config = node.config as PaintNodeConfig;
			const inputHandle = getFirstInputHandle(node.id);

			// Paint can handle empty input (canvas only) or existing image
			let imageUrl: string | undefined;
			try {
				if (inputHandle) imageUrl = extractImage(inputs, node.id, inputHandle);
			} catch (e) {
				/* ignore if optional */
			}

			const maskDataUrl = config.paintData;
			const imageHandle = getFirstOutputHandle(node.id, "Image");
			const maskHandle = getFirstOutputHandle(node.id, "Mask");

			if (!maskHandle) throw new Error("Mask output handle missing");

			const items: PaintResult["outputs"][number]["items"] = [];

			if (imageUrl && imageHandle) {
				const { imageWithMask, onlyMask } = await pixiProcessor.processMask(
					config,
					imageUrl,
					maskDataUrl,
					signal,
				);
				items.push({
					type: "Image",
					data: { dataUrl: imageWithMask },
					outputHandleId: imageHandle,
				});
				items.push({
					type: "Mask",
					data: { dataUrl: onlyMask },
					outputHandleId: maskHandle,
				});
			} else {
				items.push({
					type: "Mask",
					data: { dataUrl: maskDataUrl },
					outputHandleId: maskHandle,
				});
			}

			return { selectedOutputIndex: 0, outputs: [{ items }] };
		});

		this.registerProcessor("Blur", async ({ node, inputs, signal }) => {
			const inputHandle = getFirstInputHandle(node.id);
			const imageUrl = extractImage(inputs, node.id, inputHandle);
			const config = node.config as { size?: number };

			const dataUrl = await pixiProcessor.processBlur(
				imageUrl,
				{ blurSize: config.size ?? 1 },
				signal,
			);

			const outputHandle = getFirstOutputHandle(node.id);
			if (!outputHandle) throw new Error("Output handle missing");

			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: "Image",
								data: { dataUrl },
								outputHandleId: outputHandle,
							},
						],
					},
				],
			};
		});

		this.registerProcessor("Resize", async ({ node, inputs, signal }) => {
			const inputHandle = getFirstInputHandle(node.id);
			const imageUrl = extractImage(inputs, node.id, inputHandle);
			const config = node.config as ResizeNodeConfig;

			const dataUrl = await pixiProcessor.processResize(
				imageUrl,
				{ width: config.width, height: config.height },
				signal,
			);

			const outputHandle = getFirstOutputHandle(node.id);
			if (!outputHandle) throw new Error("Output handle missing");

			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: "Image",
								data: { dataUrl },
								outputHandleId: outputHandle,
							},
						],
					},
				],
			};
		});

		// Passthrough / Static Processors
		const passthrough = async ({ node }: NodeProcessorParams) =>
			node.result as unknown as NodeResult;

		this.registerProcessor("ImageGen", passthrough);
		this.registerProcessor("File", passthrough);
		this.registerProcessor("Agent", passthrough);
		this.registerProcessor("Text", passthrough);
		this.registerProcessor("LLM", passthrough);

		this.registerProcessor("Preview", async ({ node, inputs }) => {
			const inputHandle = getFirstInputHandle(node.id);
			if (!inputHandle) throw new Error("Preview disconnected");

			// Find source
			const edge = this.edges.find(
				(e) => e.target === node.id && e.targetHandleId === inputHandle,
			);
			if (!edge) throw new Error("Preview disconnected");

			const res = inputs.get(edge.source);
			if (!res) throw new Error("Preview waiting for input");
			return res;
		});
	}
}
