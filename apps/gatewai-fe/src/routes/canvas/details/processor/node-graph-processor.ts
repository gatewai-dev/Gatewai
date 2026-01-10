import assert from "node:assert";
import { EventEmitter } from "node:events";
import type { DataType, NodeType } from "@gatewai/db";
import {
	type BlurNodeConfig,
	type CompositorNodeConfig,
	type CropNodeConfig,
	type FileData,
	type ModulateNodeConfig,
	type NodeResult,
	type PaintNodeConfig,
	type PaintResult,
	type ResizeNodeConfig,
	TextMergerNodeConfigSchema,
	TextNodeConfigSchema,
	type VideoCompositorNodeConfig,
} from "@gatewai/types";
import type { EdgeEntityType } from "@/store/edges";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { GetAssetEndpoint } from "@/utils/file";
import { processCompositor } from "./image-compositor";
import { imageStore } from "./image-store";
import { remotionService } from "./muxer-service";
import { pixiWorkerService } from "./pixi/pixi-worker.service";
import type {
	ConnectedInput,
	NodeProcessor,
	NodeProcessorParams,
	// NodeState, // Removed import, redefining locally to match Task schema
	ProcessorConfig,
} from "./types";

// [Schema Alignment] Enum matching the Prisma TaskStatus
export enum TaskStatus {
	QUEUED = "QUEUED",
	EXECUTING = "EXECUTING",
	FAILED = "FAILED",
	COMPLETED = "COMPLETED",
}

// [Schema Alignment] Updated State to track Task metadata
export interface NodeState {
	id: string;
	status: TaskStatus | null; // Null implies idle/not queued
	isDirty: boolean; // Determines if the Node Config is out of sync with the Result

	// Task Metrics for DB sync
	startedAt?: number;
	finishedAt?: number;
	durationMs?: number;

	result: NodeResult | null;
	inputs: Record<string, ConnectedInput> | null;
	error: string | null;

	abortController: AbortController | null;
	lastProcessedSignature: string | null;
	version: number;
}

export class NodeGraphProcessor extends EventEmitter {
	private nodes = new Map<string, NodeEntityType>();
	private edges: EdgeEntityType[] = [];
	private handles: HandleEntityType[] = [];

	private edgesByTarget = new Map<string, EdgeEntityType[]>();
	private adjacency = new Map<string, Set<string>>();
	private reverseAdjacency = new Map<string, Set<string>>();
	public graphValidation: Record<string, Record<string, string>> = {};

	private nodeStates = new Map<string, NodeState>();
	private processors = new Map<string, NodeProcessor>();
	private processingLoopActive = false;
	private schedulePromise: Promise<void> | null = null;
	private isInitial = true;

	constructor() {
		super();
		this.setMaxListeners(Infinity);
		this.registerBuiltInProcessors();
	}

	private validateGraph(): void {
		const validation: Record<string, Record<string, string>> = {};

		this.nodes.forEach((_node, nodeId) => {
			const invalid: Record<string, string> = {};
			const inputHandles = this.handles.filter(
				(h) => h.nodeId === nodeId && h.type === "Input",
			);

			inputHandles.forEach((ih) => {
				const edge = this.edges.find((e) => e.targetHandleId === ih.id);
				if (!edge && this.handles.find((f) => f.id === ih.id)?.required) {
					invalid[ih.id] = "missing_connection";
					return;
				}

				if (edge) {
					const sourceHandle = this.handles.find(
						(h) => h.id === edge.sourceHandleId,
					);
					if (!sourceHandle) {
						invalid[ih.id] = "invalid_source";
						return;
					}

					const compatible = sourceHandle.dataTypes.some((t: DataType) =>
						ih.dataTypes.includes(t),
					);
					if (!compatible) {
						invalid[ih.id] = "type_mismatch";
						return;
					}
				}
			});

			if (Object.keys(invalid).length > 0) {
				validation[nodeId] = invalid;
			}
		});
		this.graphValidation = validation;
		this.emit("graph:validated", { validation });
	}

	updateGraph(config: ProcessorConfig): void {
		const prevNodes = this.nodes;
		const prevEdges = this.edges;

		// Update Internal State
		this.nodes = config.nodes;
		this.edges = config.edges;
		this.handles = config.handles;

		// Rebuild Topology Indices
		this.buildAdjacencyAndIndices();

		// Validate the graph first
		this.validateGraph();

		// Force-fail invalid nodes after validation
		Object.keys(this.graphValidation).forEach((nodeId) => {
			const state = this.getOrCreateNodeState(nodeId);
			const validationErrors = this.graphValidation[nodeId];
			state.status = TaskStatus.FAILED;
			state.error = `Invalid configuration: ${Object.values(validationErrors).join(", ")}`;
			state.isDirty = false;
			state.startedAt = undefined;
			state.finishedAt = undefined;
			state.durationMs = undefined;
			state.version++;
			this.emit("node:error", { nodeId, error: state.error });
		});

		const nodesToInvalidate = new Set<string>();

		if (this.isInitial) {
			this.isInitial = false;
			const dirtyNodes: string[] = [];
			this.nodes.forEach((currNode, id) => {
				const state = this.getOrCreateNodeState(id);
				state.error = null;
				state.abortController = null;

				// Initialize status based on existing result availability
				if (currNode.result) {
					state.result = currNode.result as unknown as NodeResult;
					state.lastProcessedSignature = this.getNodeValueHash(currNode);
					state.isDirty = false;
					// Note: We don't set COMPLETED here arbitrarily unless we are sure,
					// but generally if we have a result, it is conceptually completed.
					state.status = TaskStatus.COMPLETED;
				} else {
					state.result = null;
					state.lastProcessedSignature = null;
					state.isDirty = true;
					// Will be set to QUEUED in markNodesDirty
					dirtyNodes.push(id);
				}
				state.version++;
			});
			if (dirtyNodes.length > 0) {
				this.markNodesDirty(dirtyNodes);
			}
		} else {
			// Detect Intrinsic Node Changes (Config/Data/Index mismatch)
			this.nodes.forEach((currNode, id) => {
				const state = this.nodeStates.get(id);
				const currHash = this.getNodeValueHash(currNode);
				if (!state || state.lastProcessedSignature !== currHash) {
					nodesToInvalidate.add(id);
				}
			});

			// Detect Extrinsic Input Changes (Edges or Upstream Values)
			const inputChanges = this.detectInputChanges(
				prevEdges,
				this.edges,
				prevNodes,
				this.nodes,
			);
			inputChanges.forEach((nodeId) => {
				nodesToInvalidate.add(nodeId);
			});
		}

		// Cleanup Removed Nodes
		prevNodes.forEach((_, id) => {
			if (!this.nodes.has(id)) {
				const state = this.nodeStates.get(id);
				state?.abortController?.abort();
				this.nodeStates.delete(id);
			}
		});

		// Trigger Execution
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

	getNodeValidation(nodeId: NodeEntityType["id"]) {
		return this.graphValidation[nodeId] ?? null;
	}

	async processNode(nodeId: string): Promise<void> {
		this.markNodesDirty([nodeId]);
		await this.triggerProcessing();
	}

	retryNode(nodeId: string): void {
		const state = this.nodeStates.get(nodeId);
		if (state) {
			state.error = null;
			state.version++;
			// Retrying implies re-queueing
			this.markNodesDirty([nodeId]);
		}
	}

	registerProcessor(nodeType: NodeType, processor: NodeProcessor): void {
		if (this.processors.has(nodeType)) {
			throw new Error(`Processor for node type:${nodeType} is already set.`);
		}
		this.processors.set(nodeType, processor);
	}

	destroy(): void {
		this.nodeStates.forEach((state) => {
			state.abortController?.abort();
		});
		this.nodeStates.clear();
		this.removeAllListeners();
	}

	private markNodesDirty(startNodeIds: string[]): void {
		const queue = [...startNodeIds];
		const visited = new Set<string>();

		while (queue.length > 0) {
			const nodeId = queue.shift();
			if (!nodeId) continue;
			if (visited.has(nodeId)) continue;
			visited.add(nodeId);

			const state = this.getOrCreateNodeState(nodeId);

			// If currently executing, abort it
			if (state.status === TaskStatus.EXECUTING && state.abortController) {
				state.abortController.abort("Restarting due to graph update");
				state.abortController = null;
			}

			const validationErrors = this.graphValidation[nodeId];
			if (validationErrors && Object.keys(validationErrors).length > 0) {
				// Fail invalid nodes immediately without queuing
				state.status = TaskStatus.FAILED;
				state.error = `Invalid configuration: ${Object.values(validationErrors).join(", ")}`;
				state.isDirty = false;
				state.startedAt = undefined;
				state.finishedAt = undefined;
				state.durationMs = undefined;
				state.version++;
				this.emit("node:error", { nodeId, error: state.error });
			} else {
				// [Schema Alignment] Set status to QUEUED
				state.isDirty = true;
				state.status = TaskStatus.QUEUED;
				state.error = null;
				state.startedAt = undefined;
				state.finishedAt = undefined;
				state.durationMs = undefined;
				state.version++;

				// Notify system that this node is queued (good place to create/reset DB Task)
				this.emit("node:queued", { nodeId });
			}

			const children = this.adjacency.get(nodeId);
			if (children) {
				children.forEach((childId) => {
					queue.push(childId);
				});
			}
		}
		this.triggerProcessing();
	}

	private async triggerProcessing(): Promise<void> {
		if (this.processingLoopActive) return;
		if (!this.schedulePromise) {
			this.schedulePromise = Promise.resolve().then(() => {
				this.schedulePromise = null;
				return this.runProcessingLoop();
			});
		}
		return this.schedulePromise;
	}

	private async runProcessingLoop(): Promise<void> {
		if (this.processingLoopActive) return;
		this.processingLoopActive = true;
		try {
			let hasWork = true;
			while (hasWork) {
				let dirtyNodes = Array.from(this.nodeStates.values()).filter(
					(s) => s.isDirty,
				);

				const readyNodes = dirtyNodes.filter(
					(s) => s.status !== TaskStatus.EXECUTING && this.areInputsReady(s.id),
				);

				if (readyNodes.length > 0) {
					await Promise.all(readyNodes.map((s) => this.executeNode(s.id)));
					// Refresh dirtyNodes after executions, as states may have changed
					dirtyNodes = Array.from(this.nodeStates.values()).filter(
						(s) => s.isDirty,
					);
				}

				const stalledNodes = dirtyNodes.filter(
					(s) =>
						s.status !== TaskStatus.EXECUTING &&
						this.areAllParentsSettled(s.id) &&
						!this.areInputsReady(s.id),
				);

				for (const state of stalledNodes) {
					const nodeId = state.id;
					state.isDirty = false;
					state.status = TaskStatus.FAILED;
					state.error = "Missing required inputs due to upstream errors";
					state.finishedAt = Date.now();
					state.durationMs = state.startedAt
						? state.finishedAt - state.startedAt
						: 0;
					state.version++;
					this.emit("node:error", { nodeId, error: state.error });
				}

				if (readyNodes.length === 0 && stalledNodes.length === 0) {
					hasWork = false;
				}
			}
		} finally {
			this.processingLoopActive = false;
			if (
				Array.from(this.nodeStates.values()).some(
					(s) => s.isDirty && s.status !== TaskStatus.EXECUTING,
				)
			) {
				this.triggerProcessing();
			}
		}
	}

	private areInputsReady(nodeId: string): boolean {
		const parents = this.reverseAdjacency.get(nodeId);
		if (!parents || parents.size === 0) return true;
		for (const parentId of parents) {
			const parentState = this.nodeStates.get(parentId);
			// Parent must have a result and NOT be dirty to be considered stable
			if (!parentState?.result || parentState.isDirty) return false;
		}
		return true;
	}

	private areAllParentsSettled(nodeId: string): boolean {
		const parents = this.reverseAdjacency.get(nodeId);
		if (!parents || parents.size === 0) return true;
		for (const parentId of parents) {
			const parentState = this.nodeStates.get(parentId);
			if (!parentState || parentState.isDirty) return false;
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
			state.status = TaskStatus.FAILED;
			state.version++;
			this.emit("node:error", { nodeId, error: state.error });
			return;
		}

		// [Schema Alignment] Update Status to EXECUTING
		state.status = TaskStatus.EXECUTING;
		state.startedAt = Date.now();
		state.error = null;
		state.abortController = new AbortController();
		state.version++;
		const signal = state.abortController.signal;

		try {
			const inputs = this.collectInputs(nodeId);
			const invalidConnections = Object.values(inputs).filter(
				(v) => !v.connectionValid,
			);
			if (invalidConnections.length > 0) {
				throw new Error("Invalid input types for some connections");
			}

			state.inputs = inputs;
			state.version++;
			// emit start with timestamp
			this.emit("node:start", { nodeId, inputs, startedAt: state.startedAt });

			const result = await processor({
				node,
				inputs,
				signal,
			});

			if (signal.aborted) throw new Error("Aborted");

			// [Schema Alignment] Update Status to COMPLETED and calc duration
			state.result = result;
			state.isDirty = false;
			state.status = TaskStatus.COMPLETED;
			state.finishedAt = Date.now();
			state.durationMs =
				state.finishedAt - (state.startedAt || state.finishedAt);
			state.lastProcessedSignature = this.getNodeValueHash(node);
			state.version++;

			const hashValue = this.getImageDataUrlFromResult(state.result);
			if (hashValue) {
				if (hashValue.startsWith("http")) {
					await imageStore.addUrl(nodeId, hashValue);
				} else {
					await imageStore.addBase64(nodeId, hashValue);
				}
			}

			this.emit("node:processed", {
				nodeId,
				result,
				inputs,
				// Include duration for Task model update
				metrics: {
					startedAt: state.startedAt,
					finishedAt: state.finishedAt,
					durationMs: state.durationMs,
				},
			});
		} catch (error) {
			const isAbort =
				error instanceof Error &&
				(error.name === "AbortError" ||
					error.message === "Aborted" ||
					signal.aborted);

			if (isAbort) {
				// Aborted usually means restarting, so we don't necessarily set FAILED
				// unless the loop stops. Typically markNodesDirty handles the reset.
				state.status = TaskStatus.QUEUED; // or stay as is depending on restart logic
				state.abortController = null;
				state.version++;
				return;
			}

			console.error(`Error processing node ${nodeId}:`, error);

			// [Schema Alignment] Update Status to FAILED
			state.error = error instanceof Error ? error.message : "Unknown error";
			state.isDirty = false; // It processed, but failed.
			state.status = TaskStatus.FAILED;
			state.finishedAt = Date.now();
			state.durationMs =
				state.finishedAt - (state.startedAt || state.finishedAt);
			state.version++;

			this.emit("node:error", {
				nodeId,
				error: state.error,
				metrics: {
					durationMs: state.durationMs,
				},
			});
		} finally {
			state.abortController = null;
			state.version++;
		}
	}

	private getOrCreateNodeState(id: string): NodeState {
		let state = this.nodeStates.get(id);
		if (!state) {
			state = {
				id,
				isDirty: false,
				status: null, // Initial state
				result: null,
				inputs: null,
				error: null,
				abortController: null,
				lastProcessedSignature: null,
				version: 0,
			};
			this.nodeStates.set(id, state);
		}
		return state;
	}

	// ... (rest of the class methods: buildAdjacencyAndIndices, getNodeValueHash, detectInputChanges, collectInputs, getImageDataUrlFromResult, registerBuiltInProcessors remain the same)
	private buildAdjacencyAndIndices() {
		this.adjacency.clear();
		this.reverseAdjacency.clear();
		this.edgesByTarget.clear();

		this.nodes.forEach((_, id) => {
			this.adjacency.set(id, new Set());
			this.reverseAdjacency.set(id, new Set());
			this.edgesByTarget.set(id, []);
		});

		for (const edge of this.edges) {
			if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target))
				continue;

			this.adjacency.get(edge.source)?.add(edge.target);
			this.reverseAdjacency.get(edge.target)?.add(edge.source);
			this.edgesByTarget.get(edge.target)?.push(edge);
		}
	}

	private getNodeValueHash(node: NodeEntityType): string {
		const result = node.result as unknown as NodeResult;
		return JSON.stringify({
			c: node.config,
			d: result?.outputs?.[result?.selectedOutputIndex ?? 0],
		});
	}

	private detectInputChanges(
		prevEdges: EdgeEntityType[],
		currEdges: EdgeEntityType[],
		prevNodes: Map<string, NodeEntityType>,
		currNodes: Map<string, NodeEntityType>,
	): Set<string> {
		const changedNodes = new Set<string>();

		const getEdgeSigs = (edges: EdgeEntityType[]) => {
			const map = new Map<string, Set<string>>();
			edges.forEach((e) => {
				if (!map.has(e.target)) map.set(e.target, new Set());
				map
					.get(e.target)
					?.add(`${e.targetHandleId}|${e.source}|${e.sourceHandleId}`);
			});
			return map;
		};

		const prevEdgeMap = getEdgeSigs(prevEdges);
		const currEdgeMap = getEdgeSigs(currEdges);

		currEdgeMap.forEach((sigs, nodeId) => {
			const prevSigs = prevEdgeMap.get(nodeId);

			if (!prevSigs) {
				changedNodes.add(nodeId);
				return;
			}

			if (prevSigs.size !== sigs.size) {
				changedNodes.add(nodeId);
				return;
			}

			for (const sig of sigs) {
				if (!prevSigs.has(sig)) {
					changedNodes.add(nodeId);
					return;
				}
			}
		});

		for (const edge of currEdges) {
			const prevSource = prevNodes.get(edge.source);
			const currSource = currNodes.get(edge.source);

			if (prevSource && currSource) {
				const prevHash = this.getNodeValueHash(prevSource);
				const currHash = this.getNodeValueHash(currSource);

				if (prevHash !== currHash) {
					changedNodes.add(edge.target);
				}
			}
		}

		prevEdgeMap.forEach((_, nodeId) => {
			if (!currEdgeMap.has(nodeId) && this.nodes.has(nodeId)) {
				changedNodes.add(nodeId);
			}
		});

		return changedNodes;
	}

	private collectInputs(nodeId: string): Record<string, ConnectedInput> {
		const inputs: Record<string, ConnectedInput> = {};
		const incomingEdges = this.edgesByTarget.get(nodeId) || [];

		const sortedInputHandles = this.handles
			.filter((h) => h.nodeId === nodeId && h.type === "Input")
			.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

		for (const handle of sortedInputHandles) {
			const edge = incomingEdges.find((e) => e.targetHandleId === handle.id);

			if (!edge) continue;

			const sourceState = this.nodeStates.get(edge.source);
			if (!sourceState?.result) {
				inputs[handle.id] = {
					connectionValid: false,
					outputItem: null,
				};
				continue;
			}

			const result = sourceState.result;
			const selectedIndex = result.selectedOutputIndex ?? 0;
			const output = result.outputs[selectedIndex];
			if (!output) {
				inputs[handle.id] = {
					connectionValid: false,
					outputItem: null,
				};
				continue;
			}

			const outputItem = output.items.find(
				(i) => i.outputHandleId === edge.sourceHandleId,
			);
			if (!outputItem) {
				inputs[handle.id] = {
					connectionValid: false,
					outputItem: null,
				};
				continue;
			}

			const connectionValid = handle.dataTypes.includes(
				outputItem.type as DataType,
			);

			inputs[handle.id] = { connectionValid, outputItem };
		}

		return inputs;
	}

	private getImageDataUrlFromResult(result: NodeResult | null): string | null {
		if (!result) return null;
		const selectedIndex = result.selectedOutputIndex ?? 0;
		const output = result.outputs[selectedIndex];
		if (!output) return null;
		for (const item of output.items) {
			if (item.type === "Image" || item.type === "Mask") {
				const data = item.data as FileData;
				if (data.processData?.dataUrl) {
					return data.processData.dataUrl;
				}
				if (data.entity?.signedUrl) {
					return GetAssetEndpoint(data.entity);
				}
			}
		}
		return null;
	}

	private registerBuiltInProcessors(): void {
		const findInputData = (
			inputs: Record<string, ConnectedInput>,
			requiredType: string = "Image",
			handleLabel?: string,
		): string | undefined => {
			for (const [handleId, { connectionValid, outputItem }] of Object.entries(
				inputs,
			)) {
				if (!connectionValid || !outputItem) continue;
				if (outputItem.type !== requiredType) continue;

				if (handleLabel) {
					const handle = this.handles.find((h) => h.id === handleId);
					if (handle?.label !== handleLabel) continue;
				}

				const fileData = outputItem.data as FileData;
				const url = fileData?.entity?.signedUrl
					? GetAssetEndpoint(fileData.entity)
					: fileData?.processData?.dataUrl;
				if (url) return url;
			}
			return undefined;
		};

		const getConnectedInputDataValue = (
			inputs: Record<string, ConnectedInput>,
			handleId: string,
		): { type: "Image" | "Text" | "Audio" | "Video"; value: string } | null => {
			const input = inputs[handleId];
			if (!input || !input.connectionValid || !input.outputItem) return null;

			if (
				input.outputItem.type === "Image" ||
				input.outputItem.type === "Audio" ||
				input.outputItem.type === "Video"
			) {
				const fileData = input.outputItem.data as FileData;
				const url = fileData?.entity?.signedUrl
					? GetAssetEndpoint(fileData.entity)
					: fileData?.processData?.dataUrl;
				if (url) return { type: input.outputItem.type, value: url };
			} else if (input.outputItem.type === "Text") {
				const text = input.outputItem.data as string;
				if (text !== undefined) return { type: "Text", value: String(text) };
			}

			return null;
		};

		const getFirstOutputHandle = (nodeId: string, type: string) =>
			this.handles.find(
				(h) =>
					h.nodeId === nodeId &&
					h.type === "Output" &&
					h.dataTypes.includes(type as DataType),
			)?.id;

		this.registerProcessor("Crop", async ({ node, inputs, signal }) => {
			const imageUrl = findInputData(inputs, "Image");
			if (!imageUrl) throw new Error("Missing Input Image");

			const config = node.config as CropNodeConfig;
			const result = await pixiWorkerService.processCrop(
				imageUrl,
				{
					leftPercentage: config.leftPercentage,
					topPercentage: config.topPercentage,
					widthPercentage: config.widthPercentage,
					heightPercentage: config.heightPercentage,
				},
				signal,
			);

			const outputHandle = getFirstOutputHandle(node.id, "Image");
			if (!outputHandle) throw new Error("Output handle missing");

			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: "Image",
								data: {
									processData: {
										dataUrl: result.dataUrl,
										width: result.width,
										height: result.height,
									},
								},
								outputHandleId: outputHandle,
							},
						],
					},
				],
			};
		});

		this.registerProcessor("Paint", async ({ node, inputs, signal }) => {
			const config = node.config as PaintNodeConfig;
			const imageUrl = findInputData(inputs, "Image");
			const maskDataUrl = config.paintData;
			const imageHandle = getFirstOutputHandle(node.id, "Image");
			const maskHandle = getFirstOutputHandle(node.id, "Mask");

			if (!maskHandle) throw new Error("Mask output handle missing");

			const { imageWithMask, onlyMask } = await pixiWorkerService.processMask(
				config,
				imageUrl,
				maskDataUrl,
				signal,
			);

			const items: PaintResult["outputs"][number]["items"] = [];

			if (imageUrl && imageHandle && imageWithMask) {
				items.push({
					type: "Image",
					data: {
						processData: {
							dataUrl: imageWithMask.dataUrl,
							width: imageWithMask.width,
							height: imageWithMask.height,
						},
					},
					outputHandleId: imageHandle,
				});
			}

			items.push({
				type: "Mask",
				data: {
					processData: {
						dataUrl: onlyMask.dataUrl,
						width: onlyMask.width,
						height: onlyMask.height,
					},
				},
				outputHandleId: maskHandle,
			});

			return { selectedOutputIndex: 0, outputs: [{ items }] };
		});

		this.registerProcessor("Compositor", async ({ node, inputs, signal }) => {
			const config = node.config as CompositorNodeConfig;
			const inputDataMap: Record<
				string,
				{ type: "Image" | "Text"; value: string }
			> = {};

			Object.entries(inputs).forEach(([inputHandleId]) => {
				const data = getConnectedInputDataValue(inputs, inputHandleId);
				if (data && (data.type === "Image" || data.type === "Text")) {
					inputDataMap[inputHandleId] = data as {
						type: "Image" | "Text";
						value: string;
					};
				}
			});

			const result = await processCompositor(config, inputDataMap, signal);
			const outputHandle = getFirstOutputHandle(node.id, "Image");
			if (!outputHandle) throw new Error("Missing output handle");

			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: "Image",
								data: {
									processData: {
										dataUrl: result.dataUrl,
										width: result.width,
										height: result.height,
									},
								},
								outputHandleId: outputHandle,
							},
						],
					},
				],
			};
		});

		this.registerProcessor(
			"VideoCompositor",
			async ({ node, inputs, signal }) => {
				const config = node.config as unknown as VideoCompositorNodeConfig;
				const result = await remotionService.processVideo(
					config,
					inputs,
					signal,
				);
				return {
					selectedOutputIndex: 0,
					outputs: [
						{
							items: [
								{
									type: "Video",
									data: {
										processData: {
											dataUrl: result.dataUrl,
											width: result.width,
											height: result.height,
										},
									},
									outputHandleId: null,
								},
							],
						},
					],
				};
			},
		);

		this.registerProcessor("Blur", async ({ node, inputs, signal }) => {
			const imageUrl = findInputData(inputs, "Image");
			if (!imageUrl) throw new Error("Missing Input Image");

			const config = node.config as BlurNodeConfig;
			const result = await pixiWorkerService.processBlur(
				imageUrl,
				{ blurSize: config.size ?? 1 },
				signal,
			);
			const outputHandle = getFirstOutputHandle(node.id, "Image");
			if (!outputHandle) throw new Error("Missing output handle");
			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: "Image",
								data: {
									processData: {
										dataUrl: result.dataUrl,
										width: result.width,
										height: result.height,
									},
								},
								outputHandleId: outputHandle,
							},
						],
					},
				],
			};
		});

		this.registerProcessor("Modulate", async ({ node, inputs, signal }) => {
			const imageUrl = findInputData(inputs, "Image");
			if (!imageUrl) throw new Error("Missing Input Image");

			const config = node.config as ModulateNodeConfig;
			const result = await pixiWorkerService.processModulate(
				imageUrl,
				config,
				signal,
			);
			const outputHandle = getFirstOutputHandle(node.id, "Image");
			if (!outputHandle) throw new Error("Missing output handle");
			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: "Image",
								data: {
									processData: {
										dataUrl: result.dataUrl,
										width: result.width,
										height: result.height,
									},
								},
								outputHandleId: outputHandle,
							},
						],
					},
				],
			};
		});

		this.registerProcessor("TextMerger", async ({ node, inputs }) => {
			const config = TextMergerNodeConfigSchema.parse(node.config);
			// inputs record is already sorted by handle.createdAt due to collectInputs logic
			const allTexts = Object.values(inputs).map(
				(input) => input.outputItem?.data,
			);
			const resultText = allTexts.join(config.join);

			const outputHandle = getFirstOutputHandle(node.id, "Text");
			if (!outputHandle) throw new Error("Missing output handle");
			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: "Text",
								data: resultText,
								outputHandleId: outputHandle,
							},
						],
					},
				],
			};
		});

		this.registerProcessor("Export", async ({ inputs }) => {
			const inputEntries = Object.entries(inputs);
			if (inputEntries.length === 0)
				throw new Error("Missing input for Export");

			const [_, { outputItem }] = inputEntries[0];
			if (!outputItem) throw new Error("No input item");

			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: outputItem.type,
								data: outputItem.data,
								outputHandleId: undefined,
							},
						],
					},
				],
			};
		});

		this.registerProcessor("Resize", async ({ node, inputs, signal }) => {
			const imageUrl = findInputData(inputs, "Image");
			if (!imageUrl) throw new Error("Missing Input Image");

			const config = node.config as ResizeNodeConfig;
			const result = await pixiWorkerService.processResize(
				imageUrl,
				{ width: config.width, height: config.height },
				signal,
			);
			const outputHandle = getFirstOutputHandle(node.id, "Image");
			if (!outputHandle) throw new Error("Missing output handle");
			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: "Image",
								data: {
									processData: {
										dataUrl: result.dataUrl,
										width: result.width,
										height: result.height,
									},
								},
								outputHandleId: outputHandle,
							},
						],
					},
				],
			};
		});

		this.registerProcessor("Preview", async ({ inputs }) => {
			const inputEntries = Object.entries(inputs);
			if (inputEntries.length === 0) throw new Error("Preview disconnected");
			const [_, { outputItem }] = inputEntries[0];
			if (!outputItem) throw new Error("No input item");
			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: outputItem.type,
								data: outputItem.data,
								outputHandleId: undefined,
							},
						],
					},
				],
			};
		});

		// We're passing from config since result updates should be done by processor only not input
		this.registerProcessor("Text", async ({ node }) => {
			const outputHandle = getFirstOutputHandle(node.id, "Text");
			const config = TextNodeConfigSchema.parse(node.config);
			if (!outputHandle) throw new Error("No input handle");
			return {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: "Text",
								data: config.content,
								outputHandleId: outputHandle,
							},
						],
					},
				],
			};
		});

		const passthrough = async ({ node }: NodeProcessorParams) =>
			node.result as unknown as NodeResult;
		this.registerProcessor("ImageGen", passthrough);
		this.registerProcessor("File", passthrough);
		this.registerProcessor("Agent", passthrough);
		this.registerProcessor("LLM", passthrough);
		this.registerProcessor("VideoGen", passthrough);
		this.registerProcessor("VideoGenExtend", passthrough);
		this.registerProcessor("VideoGenFirstLastFrame", passthrough);
		this.registerProcessor("TextToSpeech", passthrough);
		this.registerProcessor("SpeechToText", passthrough);
	}
}
