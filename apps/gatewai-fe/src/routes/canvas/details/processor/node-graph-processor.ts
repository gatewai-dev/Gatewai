import { EventEmitter } from "node:events";
import type { NodeType } from "@gatewai/db";
import type {
	AgentResult,
	CropNodeConfig,
	FileData,
	FileResult,
	ImageGenResult,
	LLMResult,
	NodeResult,
	PaintNodeConfig,
	PaintResult,
	ResizeNodeConfig,
	TextResult,
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
	isDirty: boolean;
	isProcessing: boolean;
	result: NodeResult | null;
	error: string | null;
	abortController: AbortController | null;
}

type NodeProcessor = (params: {
	node: NodeEntityType;
	inputs: Map<string, NodeResult>;
	signal: AbortSignal;
}) => Promise<NodeResult | null>;

/**
 * Centralized graph processor - handles all node computation outside React lifecycle
 */
export class NodeGraphProcessor extends EventEmitter {
	private nodes = new Map<string, NodeEntityType>();
	private edges: EdgeEntityType[] = [];
	private handles: HandleEntityType[] = [];
	private prevEdges: EdgeEntityType[] = []; // Added for edge change detection
	private nodeStates = new Map<string, NodeState>();
	private processors = new Map<string, NodeProcessor>();
	private dependencyGraph = new Map<string, Set<string>>(); // nodeId -> downstream nodeIds
	private reverseDependencyGraph = new Map<string, Set<string>>(); // nodeId -> upstream nodeIds
	private isProcessing = false;

	constructor() {
		super();
		// Prevent EventEmitter memory leak warnings for many nodes
		// It doesn't leak currently, but throws a warning if >10 listeners are added
		// The amount of listeners equals the amount of nodes being processed
		this.setMaxListeners(Infinity);
		this.registerBuiltInProcessors();
	}

	/**
	 * Update graph structure from Redux store
	 */
	updateGraph(config: ProcessorConfig): void {
		const prevNodes = new Map(this.nodes);
		const prevEdges = [...this.prevEdges];

		this.nodes = config.nodes;
		this.edges = config.edges;
		this.handles = config.handles;

		// Rebuild dependency graphs
		this.buildDependencyGraphs();

		// Find changed nodes and mark as dirty
		config.nodes.forEach((node, id) => {
			const prev = prevNodes.get(id);
			this.getOrCreateNodeState(id);

			if (
				!prev ||
				this.hasNodeChanged(prev, node) ||
				this.hasNodeInputsChanged(id, prevEdges)
			) {
				this.markDirty(id, true);
			}
		});

		// Clean up states for deleted nodes
		prevNodes.forEach((_, id) => {
			if (!this.nodes.has(id)) {
				this.nodeStates.delete(id);
			}
		});

		// Update prevEdges
		this.prevEdges = [...this.edges];
	}

	/**
	 * Get current result for a node
	 */
	getNodeResult(nodeId: NodeEntityType["id"]): NodeResult | null {
		return this.nodeStates.get(nodeId)?.result ?? null;
	}

	/**
	 * Get processing state for a node
	 */
	getNodeState(nodeId: NodeEntityType["id"]): NodeState | null {
		return this.nodeStates.get(nodeId) ?? null;
	}

	/**
	 * Manually trigger processing for a node
	 */
	async processNode(nodeId: NodeEntityType["id"]): Promise<void> {
		this.markDirty(nodeId, true);
		await this.startProcessing();
	}

	/**
	 * Register a custom processor for a node type
	 */
	registerProcessor(nodeType: NodeType, processor: NodeProcessor): void {
		this.processors.set(nodeType, processor);
	}

	private registerBuiltInProcessors(): void {
		// Crop processor
		this.registerProcessor("Crop", async ({ node, inputs, signal }) => {
			const inputHandle = this.getInputHandleIDs(node.id)[0];
			if (!inputHandle) return null;

			const sourceNodeId = this.getSourceNodeID(node.id, inputHandle);

			if (!sourceNodeId) return null;
			const inputResult = inputs.get(sourceNodeId);
			if (!inputResult) return null;

			// Extract image URL
			const sourceHandleId = this.getSourceHandleId(inputHandle);

			const output = inputResult.outputs[inputResult.selectedOutputIndex ?? 0];
			const fileData = output?.items.find(
				(f) => f.outputHandleId === sourceHandleId,
			)?.data as FileData;
			const imageUrl = fileData?.entity?.signedUrl ?? fileData?.dataUrl;

			if (!imageUrl) throw new Error("No image URL");

			// Process with Pixi
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

			// Build result
			const outputHandleEntity = this.getOutputHandleEntities(node.id).find(
				(f) => f.dataTypes.includes("Image") && f.type === "Output",
			);
			if (!outputHandleEntity) {
				throw new Error("Output handle not found");
			}
			console.log({ outputHandleEntity, node: node.id });
			const outputHandle = outputHandleEntity.id;
			const newResult: NodeResult = {
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

			return newResult;
		});

		this.registerProcessor("Paint", async ({ node, inputs, signal }) => {
			const config = node.config as PaintNodeConfig;

			const inputHandle = this.getInputHandleIDs(node.id)[0];
			const sourceNodeId = inputHandle
				? this.getSourceNodeID(node.id, inputHandle)
				: null;

			const sourceHandleId = this.getSourceHandleId(inputHandle);
			let imageUrl: string | undefined | null;
			if (sourceNodeId) {
				const inputResult = inputs.get(sourceNodeId);
				if (!inputResult) return null;

				const output =
					inputResult.outputs[inputResult.selectedOutputIndex ?? 0];
				const fileData = output?.items.find(
					(f) => f.outputHandleId === sourceHandleId,
				)?.data as FileData;
				imageUrl = fileData?.entity?.signedUrl ?? fileData?.dataUrl;

				if (!imageUrl) {
					console.log({ inputResult });
					throw new Error("No image URL");
				}
			}

			const maskDataUrl = config.paintData;

			const outputHandles = this.getOutputHandleEntities(node.id);
			const imageOutputHandle = outputHandles.find((f) =>
				f.dataTypes.includes("Image"),
			);
			const maskOutputHandle = outputHandles.find((f) =>
				f.dataTypes.includes("Mask"),
			);

			if (!maskOutputHandle) {
				throw new Error("Missing output handles");
			}

			const items: PaintResult["outputs"][number]["items"] = [];

			let onlyMask = maskDataUrl;
			let imageWithMask: string | undefined;

			if (sourceNodeId) {
				if (!imageOutputHandle) throw new Error("Missing image output handle");
				const {
					imageWithMask: processedImageWithMask,
					onlyMask: processedOnlyMask,
				} = await pixiProcessor.processMask(
					config,
					imageUrl,
					maskDataUrl,
					signal,
				);

				imageWithMask = processedImageWithMask;
				onlyMask = processedOnlyMask;

				items.push({
					type: "Image",
					data: { dataUrl: imageWithMask },
					outputHandleId: imageOutputHandle.id,
				});
			}

			items.push({
				type: "Mask",
				data: { dataUrl: onlyMask },
				outputHandleId: maskOutputHandle.id,
			});

			const newResult: PaintResult = {
				selectedOutputIndex: 0,
				outputs: [
					{
						items,
					},
				],
			};

			return newResult;
		});
		// Blur processor
		this.registerProcessor("Blur", async ({ node, inputs, signal }) => {
			console.log({ node });
			const inputHandleId = this.getInputHandleIDs(node.id)[0];
			if (!inputHandleId) {
				console.warn({ inputHandleId, nodeId: node.id });
				return null;
			}

			const sourceNodeId = this.getSourceNodeID(node.id, inputHandleId);
			if (!sourceNodeId) {
				console.warn({ sourceNodeId, nodeId: node.id });
				return null;
			}

			const inputResult = inputs.get(sourceNodeId);
			if (!inputResult) {
				console.warn({ inputResult, nodeId: node.id });
				return null;
			}

			const sourceHandleId = this.getSourceHandleId(inputHandleId);

			const output = inputResult.outputs[inputResult.selectedOutputIndex ?? 0];
			const fileData = output?.items.find(
				(f) => f.outputHandleId === sourceHandleId,
			)?.data as FileData;
			const imageUrl = fileData?.entity?.signedUrl ?? fileData?.dataUrl;

			if (!imageUrl) throw new Error("No image URL");
			console.log({
				imageUrl,
				nodeId: node.id,
				ww: output?.items,
				sourceHandleId,
			});
			if (!imageUrl) return null;
			// Process with Pixi
			const config = node.config as { size?: number };
			const dataUrl = await pixiProcessor.processBlur(
				imageUrl,
				{ blurSize: config.size ?? 1 },
				signal,
			);

			// Attach to only output
			const outputHandleEntity = this.getOutputHandleEntities(node.id).find(
				(f) => f.dataTypes.includes("Image"),
			);
			if (!outputHandleEntity) {
				throw new Error("Output handle not found");
			}
			const outputHandle = outputHandleEntity.id;
			const newResult: NodeResult = {
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
			console.log({ newResult });
			return newResult;
		});

		// File processor (no computation, just return existing; cache based on config if needed)
		this.registerProcessor("ImageGen", async ({ node }) => {
			// If no cached, use existing node.result (assuming it's set)
			const result = node.result as unknown as ImageGenResult;
			if (!result) throw new Error("No result for ImageGen node");
			return result;
		});

		this.registerProcessor("File", async ({ node }) => {
			// If no cached, use existing node.result (assuming it's set)
			const result = node.result as unknown as FileResult;
			if (!result) throw new Error("No result for File node");
			return result;
		});

		this.registerProcessor("Agent", async ({ node }) => {
			// If no cached, use existing node.result (assuming it's set)
			const result = node.result as unknown as AgentResult;
			if (!result) throw new Error("No result for Agent node");
			return result;
		});

		this.registerProcessor("Text", async ({ node }) => {
			// If no cached, use existing node.result (assuming it's set)
			const result = node.result as unknown as TextResult;
			if (!result) throw new Error("No result for Text node");
			return result;
		});

		// File processor (no computation, just return existing; cache based on config if needed)
		this.registerProcessor("LLM", async ({ node }) => {
			// If no cached, use existing node.result (assuming it's set)
			const result = node.result as unknown as LLMResult;
			if (!result) throw new Error("No result for Text node");
			return result;
		});

		// Resize processor
		this.registerProcessor("Resize", async ({ node, inputs, signal }) => {
			const inputHandleId = this.getInputHandleIDs(node.id)[0];
			if (!inputHandleId) return null;

			const sourceNodeId = this.getSourceNodeID(node.id, inputHandleId);
			if (!sourceNodeId) return null;

			const inputResult = inputs.get(sourceNodeId);
			if (!inputResult) return null;
			const sourceHandleId = this.getSourceHandleId(inputHandleId);
			console.log({ sourceHandleId });
			// Extract image URL
			const output = inputResult.outputs[inputResult.selectedOutputIndex ?? 0];
			const fileData = output?.items.find(
				(f) => f.outputHandleId === sourceHandleId,
			)?.data as FileData;
			const imageUrl = fileData?.entity?.signedUrl ?? fileData?.dataUrl;
			console.log({ imageUrl });
			if (!imageUrl) return null;

			// Process with Pixi
			const config = node.config as ResizeNodeConfig;
			const dataUrl = await pixiProcessor.processResize(
				imageUrl,
				{ width: config.width, height: config.height },
				signal,
			);

			// Build result
			const outputHandleEntity = this.getOutputHandleEntities(node.id).find(
				(f) => f.dataTypes.includes("Image"),
			);
			if (!outputHandleEntity) {
				throw new Error("Output handle not found");
			}
			const outputHandle = outputHandleEntity.id;
			const newResult: NodeResult = {
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

			return newResult;
		});
	}

	private getOrCreateNodeState(nodeId: NodeEntityType["id"]): NodeState {
		const existing = this.nodeStates.get(nodeId);
		if (existing) {
			return existing;
		}

		const newState: NodeState = {
			isDirty: false,
			isProcessing: false,
			result: null,
			error: null,
			abortController: null,
		};
		this.nodeStates.set(nodeId, newState);
		return newState;
	}

	private hasNodeChanged(prev: NodeEntityType, curr: NodeEntityType): boolean {
		// Compare config and result (for nodes like File where result represents source/input data)
		const prevConfigStr = JSON.stringify(prev.config);
		const currConfigStr = JSON.stringify(curr.config);
		const prevResultStr = JSON.stringify(prev.result ?? null);
		const currResultStr = JSON.stringify(curr.result ?? null);
		return prevConfigStr !== currConfigStr || prevResultStr !== currResultStr;
	}

	private hasNodeInputsChanged(
		nodeId: NodeEntityType["id"],
		prevEdges: EdgeEntityType[],
	): boolean {
		const prevInputs = new Map<string, string>(); // targetHandleId -> sourceNodeId
		prevEdges.forEach((e) => {
			if (e.target === nodeId) {
				prevInputs.set(e.targetHandleId, e.sourceHandleId);
			}
		});

		const currInputs = new Map<string, string>(); // targetHandleId -> sourceNodeId
		this.edges.forEach((e) => {
			if (e.target === nodeId) {
				currInputs.set(e.targetHandleId, e.sourceHandleId);
			}
		});
		console.log({ nodeId, prevEdges, de: this.edges });

		if (prevInputs.size !== currInputs.size) return true;

		for (const [handleId, sourceId] of prevInputs) {
			if (currInputs.get(handleId) !== sourceId) return true;
		}
		return false;
	}

	private buildDependencyGraphs(): void {
		this.dependencyGraph.clear();
		this.reverseDependencyGraph.clear();

		this.nodes.forEach((_, id) => {
			this.dependencyGraph.set(id, new Set());
			this.reverseDependencyGraph.set(id, new Set());
		});

		this.edges.forEach((edge) => {
			if (this.nodes.has(edge.source) && this.nodes.has(edge.target)) {
				const sourceSet = this.dependencyGraph.get(edge.source);
				const targetSet = this.reverseDependencyGraph.get(edge.target);

				if (sourceSet && targetSet) {
					sourceSet.add(edge.target);
					targetSet.add(edge.source);
				}
			}
		});
	}

	private buildSubgraphDepGraphs(necessaryIds: string[]): {
		depGraph: Map<string, string[]>;
		revDepGraph: Map<string, string[]>;
	} {
		const selectedSet = new Set(necessaryIds);
		const depGraph = new Map(necessaryIds.map((id) => [id, new Set<string>()]));
		const revDepGraph = new Map(
			necessaryIds.map((id) => [id, new Set<string>()]),
		);

		for (const edge of this.edges) {
			if (selectedSet.has(edge.source) && selectedSet.has(edge.target)) {
				const sourceSet = depGraph.get(edge.source);
				const targetSet = revDepGraph.get(edge.target);

				if (sourceSet && targetSet) {
					sourceSet.add(edge.target);
					targetSet.add(edge.source);
				}
			}
		}

		// Convert Sets to arrays for topological sort
		const depArray = new Map<string, string[]>();
		const revArray = new Map<string, string[]>();
		depGraph.forEach((value, key) => {
			depArray.set(key, Array.from(value));
		});
		revDepGraph.forEach((value, key) => {
			revArray.set(key, Array.from(value));
		});

		return { depGraph: depArray, revDepGraph: revArray };
	}

	private topologicalSort(
		nodes: string[],
		depGraph: Map<string, string[]>,
		revDepGraph: Map<string, string[]>,
	): string[] | null {
		const indegree = new Map(
			nodes.map((id) => [id, (revDepGraph.get(id) ?? []).length]),
		);
		const queue: string[] = nodes.filter((id) => {
			const deg = indegree.get(id);
			return deg !== undefined && deg === 0;
		});
		const order: string[] = [];

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) break;

			order.push(current);

			const downstream = depGraph.get(current) ?? [];
			for (const ds of downstream) {
				const currentDeg = indegree.get(ds);
				if (currentDeg !== undefined) {
					const deg = currentDeg - 1;
					indegree.set(ds, deg);
					if (deg === 0) {
						queue.push(ds);
					}
				}
			}
		}

		return order.length === nodes.length ? order : null;
	}

	private markDirty(nodeId: NodeEntityType["id"], cascade: boolean): void {
		const state = this.getOrCreateNodeState(nodeId);

		// Cancel if already processing
		if (state.isProcessing && state.abortController) {
			state.abortController.abort();
			state.isProcessing = false;
		}

		state.isDirty = true;
		state.result = null; // Added: Invalidate previous result on dirty

		// Cascade to downstream nodes
		if (cascade) {
			const downstream = Array.from(
				this.dependencyGraph.get(nodeId) ?? new Set(),
			);
			downstream.forEach((downstreamId) => {
				if (typeof downstreamId === "string") {
					this.markDirty(downstreamId, true);
				} else {
					throw new Error(`Invalid node Id detected: ${downstreamId}`);
				}
			});
		}

		// Trigger processing
		this.startProcessing();
	}

	private async startProcessing(): Promise<void> {
		if (this.isProcessing) return;
		this.isProcessing = true;

		try {
			while (true) {
				// Collect dirty node IDs
				const dirtyIds = Array.from(this.nodeStates.entries())
					.filter(([, state]) => state.isDirty)
					.map(([id]) => id);
				console.log({ dirtyIds });
				if (dirtyIds.length === 0) break;

				// Compute necessary nodes: dirty + upstream dependencies that need processing
				const necessary = new Set<string>();
				const queue: string[] = [...dirtyIds];
				while (queue.length > 0) {
					const curr = queue.shift();
					if (!curr) break;
					if (necessary.has(curr)) continue;

					necessary.add(curr);
					const ups = Array.from(this.reverseDependencyGraph.get(curr) ?? []);
					ups.forEach((up) => {
						const upState = this.getOrCreateNodeState(up);
						if (!upState.result || upState.isDirty) {
							queue.push(up);
						}
					});
				}

				const necessaryIds = Array.from(necessary);

				// Mark upstream nodes as dirty if they lack results
				necessaryIds.forEach((id) => {
					const state = this.getOrCreateNodeState(id);
					if (!state.result) {
						state.isDirty = true;
					}
				});
				const { depGraph, revDepGraph } =
					this.buildSubgraphDepGraphs(necessaryIds);

				const topoOrder = this.topologicalSort(
					necessaryIds,
					depGraph,
					revDepGraph,
				);
				if (!topoOrder) {
					this.emit("graph:error", {
						message: "Cycle detected in dependency graph",
					});
					return;
				}

				// Process nodes in topological order
				for (const nodeId of topoOrder) {
					const state = this.getOrCreateNodeState(nodeId);
					if (!state.isDirty) continue;

					// Inputs should be ready due to topo order, but verify
					if (!this.ensureInputsReady(nodeId)) {
						console.warn(`Inputs not ready for node ${nodeId}`);
					}
					if (state.isProcessing) continue;

					state.isProcessing = true;
					state.abortController = new AbortController();
					state.error = null;

					try {
						const node = this.nodes.get(nodeId);
						if (!node) throw new Error(`Node ${nodeId} missing`);

						const processor = this.processors.get(node.type);
						if (!processor) {
							throw new Error(`No processor for node type: ${node.type}`);
						}

						const inputs = this.collectInputs(nodeId);
						console.log("node:start", { nodeId, inputs });
						const result = await processor({
							node,
							inputs,
							signal: state.abortController.signal,
						});
						console.log("node:processed", { nodeId, result });
						state.result = result;
						state.isDirty = false;
						this.emit("node:processed", { nodeId, result });
					} catch (error) {
						if (error instanceof Error && error.name === "AbortError") {
							// Cancelled - will be re-queued in next while iteration
							state.isDirty = false;
						} else {
							state.error =
								error instanceof Error ? error.message : "Unknown error";
							state.isDirty = false;
						}
						this.emit("node:error", { nodeId, error: state.error });
					} finally {
						state.isProcessing = false;
						state.abortController = null;
					}
				}
			}
		} finally {
			this.isProcessing = false;
		}
	}

	private ensureInputsReady(nodeId: NodeEntityType["id"]): boolean {
		const sourceNodeIds = this.getSourceNodeIDs(nodeId);

		for (const sourceId of sourceNodeIds) {
			const sourceState = this.nodeStates.get(sourceId);
			if (
				!sourceState?.result ||
				sourceState.isDirty ||
				sourceState.isProcessing
			) {
				return false;
			}
		}

		return true;
	}

	private collectInputs(nodeId: NodeEntityType["id"]): Map<string, NodeResult> {
		const inputs = new Map<string, NodeResult>();
		const sourceNodeIds = this.getSourceNodeIDs(nodeId);

		sourceNodeIds.forEach((sourceId) => {
			const state = this.nodeStates.get(sourceId);
			if (state?.result) {
				inputs.set(sourceId, state.result);
			}
		});

		return inputs;
	}

	private getSourceNodeIDs(nodeId: NodeEntityType["id"]): string[] {
		return this.edges.filter((e) => e.target === nodeId).map((e) => e.source);
	}

	private getSourceHandleId(targetHandleId: HandleEntityType["id"]) {
		return this.edges.find((f) => f.targetHandleId === targetHandleId)
			?.sourceHandleId;
	}

	private getSourceNodeID(
		nodeId: NodeEntityType["id"],
		handleId: HandleEntityType["id"],
	): string | null {
		const edge = this.edges.find(
			(e) => e.target === nodeId && e.targetHandleId === handleId,
		);
		return edge?.source ?? null;
	}

	private getInputHandleIDs(nodeId: NodeEntityType["id"]): string[] {
		return Array.from(
			new Set(
				this.handles
					.filter((e) => e.nodeId === nodeId && e.type === "Input")
					.map((e) => e.id),
			),
		);
	}

	private getOutputHandleEntities(
		nodeId: NodeEntityType["id"],
	): HandleEntityType[] {
		return Array.from(
			new Set(
				this.handles.filter((e) => e.nodeId === nodeId && e.type === "Output"),
			),
		);
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.nodeStates.forEach((state) => {
			if (state.abortController) {
				state.abortController.abort();
			}
		});
		this.nodeStates.clear();
		this.removeAllListeners();
	}
}
