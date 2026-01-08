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
	type VideoCompositorNodeConfig,
} from "@gatewai/types";
import type { EdgeEntityType } from "@/store/edges";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { GetAssetEndpoint } from "@/utils/file";
import { imageStore } from "./image-store";
import { remotionService } from "./muxer-service";
import { pixiProcessor } from "./pixi-service";
import RemotionWorker from "./remotion.worker.ts?worker";
import type {
	ConnectedInput,
	NodeProcessor,
	NodeProcessorParams,
	NodeState,
	ProcessorConfig,
} from "./types";

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

		const nodesToInvalidate = new Set<string>();

		if (this.isInitial) {
			this.isInitial = false;
			const dirtyNodes: string[] = [];
			this.nodes.forEach((currNode, id) => {
				const state = this.getOrCreateNodeState(id);
				state.error = null;
				state.isProcessing = false;
				state.abortController = null;
				if (currNode.result) {
					state.result = currNode.result as unknown as NodeResult;
					state.lastProcessedSignature = this.getNodeValueHash(currNode);
					state.isDirty = false;
				} else {
					state.result = null;
					state.lastProcessedSignature = null;
					state.isDirty = true;
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

		//  Cleanup Removed Nodes
		prevNodes.forEach((_, id) => {
			if (!this.nodes.has(id)) {
				const state = this.nodeStates.get(id);
				state?.abortController?.abort();
				this.nodeStates.delete(id);
			}
		});

		// 6. Trigger Execution
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

	// New method to retry a failed node
	retryNode(nodeId: string): void {
		const state = this.nodeStates.get(nodeId);
		if (state) {
			state.error = null;
			state.isDirty = true;
			state.version++;
			this.triggerProcessing();
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

			// Abort current execution if it's already running
			if (state.isProcessing && state.abortController) {
				state.abortController.abort("Restarting due to graph update");
				state.abortController = null;
			}

			state.isDirty = true;
			state.error = null;
			state.version++;

			// Propagate dirtiness to children
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
				const dirtyNodes = Array.from(this.nodeStates.values()).filter(
					(s) => s.isDirty,
				);
				const readyNodes = dirtyNodes.filter(
					(s) => !s.isProcessing && this.areInputsReady(s.id),
				);

				if (readyNodes.length === 0) {
					hasWork = false;
					break;
				}

				await Promise.all(readyNodes.map((s) => this.executeNode(s.id)));
			}
		} finally {
			this.processingLoopActive = false;
			// Catch trailing dirty states
			if (
				Array.from(this.nodeStates.values()).some(
					(s) => s.isDirty && !s.isProcessing,
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
			if (!parentState?.result || parentState.isDirty) return false;
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
			state.isDirty = false; // Stop trying
			state.version++;
			this.emit("node:error", { nodeId, error: state.error });
			return;
		}

		state.isProcessing = true;
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
				console.log({ inputs });
				throw new Error("Invalid input types for some connections");
			}

			state.inputs = inputs;
			state.version++;
			this.emit("node:start", { nodeId, inputs });

			const result = await processor({
				node,
				inputs,
				signal,
			});

			if (signal.aborted) throw new Error("Aborted");

			state.result = result;
			state.isDirty = false;
			// Update the signature trace
			state.lastProcessedSignature = this.getNodeValueHash(node);
			state.version++;

			// Store image data with lightweight hash if applicable
			const hashValue = this.getImageDataUrlFromResult(state.result);
			if (hashValue) {
				if (hashValue.startsWith("http")) {
					console.log({ hashValue });
					await imageStore.addUrl(nodeId, hashValue);
				} else {
					await imageStore.addBase64(nodeId, hashValue);
				}
			}

			this.emit("node:processed", { nodeId, result, inputs });
		} catch (error) {
			const isAbort =
				error instanceof Error &&
				(error.name === "AbortError" || error.message === "Aborted");

			if (isAbort) {
				state.isProcessing = false;
				state.abortController = null;
				state.version++;
				return;
			}

			console.error(`Error processing node ${nodeId}:`, error);
			state.error = error instanceof Error ? error.message : "Unknown error";
			state.isDirty = false;
			state.version++;
			this.emit("node:error", { nodeId, error: state.error });
		} finally {
			state.isProcessing = false;
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
				isProcessing: false,
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
			// Configuration parameters (e.g. crop coordinates)
			c: node.config,
			// Data payload (e.g. uploaded file object, signed URLs)
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

		// Helper to generate edge signatures
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

		// Check if connections were added/removed/swapped
		currEdgeMap.forEach((sigs, nodeId) => {
			const prevSigs = prevEdgeMap.get(nodeId);

			// New connection entirely
			if (!prevSigs) {
				changedNodes.add(nodeId);
				return;
			}

			// Different set of connections
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

		// # Check if the connected source node changed value
		// Even if the Edge is identical, if the Source Node has a new file or index,
		// the Target Node must update.
		for (const edge of currEdges) {
			const prevSource = prevNodes.get(edge.source);
			const currSource = currNodes.get(edge.source);

			if (prevSource && currSource) {
				const prevHash = this.getNodeValueHash(prevSource);
				const currHash = this.getNodeValueHash(currSource);

				if (prevHash !== currHash) {
					// The source changed, so the target gets a new input
					changedNodes.add(edge.target);
				}
			}
		}

		// # Check for removed connections (orphaned nodes)
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

		for (const edge of incomingEdges) {
			const sourceState = this.nodeStates.get(edge.source);
			if (!sourceState?.result) {
				inputs[edge.targetHandleId] = {
					connectionValid: false,
					outputItem: null,
				};
				continue;
			}

			const result = sourceState.result;
			const selectedIndex = result.selectedOutputIndex ?? 0;
			const output = result.outputs[selectedIndex];
			if (!output) {
				inputs[edge.targetHandleId] = {
					connectionValid: false,
					outputItem: null,
				};
				continue;
			}

			const outputItem = output.items.find(
				(i) => i.outputHandleId === edge.sourceHandleId,
			);
			if (!outputItem) {
				inputs[edge.targetHandleId] = {
					connectionValid: false,
					outputItem: null,
				};
				continue;
			}

			const targetHandle = this.handles.find(
				(h) => h.id === edge.targetHandleId,
			);
			if (!targetHandle) {
				inputs[edge.targetHandleId] = {
					connectionValid: false,
					outputItem: null,
				};
				continue;
			}

			const connectionValid = targetHandle.dataTypes.includes(
				outputItem.type as DataType,
			);

			inputs[edge.targetHandleId] = { connectionValid, outputItem };
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
					console.log(data.entity?.signedUrl, data.entity);
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
			const result = await pixiProcessor.processCrop(
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

			const { imageWithMask, onlyMask } = await pixiProcessor.processMask(
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
			} else {
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
			}

			return { selectedOutputIndex: 0, outputs: [{ items }] };
		});

		this.registerProcessor("Compositor", async ({ node, inputs, signal }) => {
			console.log("ANAN");
			const config = node.config as CompositorNodeConfig;

			//  Prepare Inputs for Pixi Service
			// Map the Layer's Input Handle ID -> Actual Data (URL or Text)
			const inputDataMap: Record<
				string,
				{ type: "Image" | "Text"; value: string }
			> = {};

			Object.entries(inputs).forEach(([inputHandleId, _value]) => {
				const data = getConnectedInputDataValue(inputs, inputHandleId);
				if (data) {
					inputDataMap[inputHandleId] = data;
				}
			});

			// Process with Pixi
			const result = await pixiProcessor.processCompositor(
				config,
				inputDataMap,
				signal,
			);

			// Find Output Handle (Standard "Image" output)
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
				// Process with web renderer
				const start = Date.now();
				const result = await remotionService.processVideo(
					config,
					inputs,
					signal,
				);
				const end = Date.now();
				console.log((end - start) / 1000);

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
			const result = await pixiProcessor.processBlur(
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
			const result = await pixiProcessor.processModulate(
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
			const allTexts = Object.values(inputs).map((input) => {
				return input.outputItem?.data;
			});
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
			if (inputEntries.length === 0) {
				throw new Error("Missing input for Export");
			}
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
			const result = await pixiProcessor.processResize(
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
			if (inputEntries.length === 0) {
				throw new Error("Preview disconnected");
			}
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

		// Passthrough / Noop Processors
		const passthrough = async ({ node }: NodeProcessorParams) =>
			node.result as unknown as NodeResult;
		this.registerProcessor("ImageGen", passthrough);
		this.registerProcessor("File", passthrough);
		this.registerProcessor("Agent", passthrough);
		this.registerProcessor("Text", passthrough);
		this.registerProcessor("LLM", passthrough);
		this.registerProcessor("VideoGen", passthrough);
		this.registerProcessor("VideoGenExtend", passthrough);
		this.registerProcessor("VideoGenFirstLastFrame", passthrough);
		this.registerProcessor("TextToSpeech", passthrough);
		this.registerProcessor("SpeechToText", passthrough);
	}
}
