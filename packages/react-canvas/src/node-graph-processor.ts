import { EventEmitter } from "node:events";
import { GetAssetEndpoint } from "@gatewai/core/browser";
import {
	dataTypeColors,
	type FileData,
	type IPixiProcessor,
	type NodeResult,
	type OutputItem,
} from "@gatewai/core/types";
import type { DataType } from "@gatewai/db";
import { pixiWorkerService } from "@gatewai/media/browser";
import type { NodeProcessor } from "@gatewai/node-sdk/browser";
import type {
	EdgeEntityType,
	HandleEntityType,
	NodeEntityType,
} from "@gatewai/react-store";
import type {
	ConnectedInput,
	DiscoveredNodeRegistry,
	HandleState,
	NodeProcessorContext,
	NodeProcessorParams,
	NodeRunFunction,
	NodeState,
	ProcessorConfig,
} from "./types";
import { TaskStatus } from "./types";

export class NodeGraphProcessor extends EventEmitter implements NodeProcessor {
	private nodes = new Map<string, NodeEntityType>();
	private edges: EdgeEntityType[] = [];
	private handles: HandleEntityType[] = [];

	private edgesByTarget = new Map<string, EdgeEntityType[]>();
	private adjacency = new Map<string, Set<string>>();
	private reverseAdjacency = new Map<string, Set<string>>();
	public graphValidation: Record<string, Record<string, string>> = {};

	private nodeStates = new Map<string, NodeState>();
	private processors = new Map<string, NodeRunFunction>();
	private objectUrls = new Map<string, string[]>();
	private processingLoopActive = false;
	private schedulePromise: Promise<void> | null = null;

	private isInitial = true;
	private registry?: DiscoveredNodeRegistry;

	constructor(registry?: DiscoveredNodeRegistry) {
		super();
		this.setMaxListeners(Infinity);
		this.registry = registry;
		if (!registry) {
			console.warn(
				"NodeGraphProcessor initialized without registry. Nodes may not execute.",
			);
		}
	}

	/**
	 * Static validation of the graph topology.
	 * Checks if edges connect handles with compatible *definitions* (intersection of types).
	 * Does not check runtime values.
	 */
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

					// Static check: Do the handle definitions overlap at all?
					// e.g. Source: [Image, Video], Target: [Image] -> Valid
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

		// Validate the graph first (Structural/Static validation)
		this.validateGraph();

		// Force-fail invalid nodes after validation
		// For terminal nodes (like LLM), we must preserve their existing results
		// since their passthrough processor won't run when validation fails.
		Object.keys(this.graphValidation).forEach((nodeId) => {
			const node = this.nodes.get(nodeId);
			const state = this.getOrCreateNodeState(nodeId);
			const validationErrors = this.graphValidation[nodeId];
			state.status = TaskStatus.FAILED;
			state.error = `Invalid configuration: ${Object.values(validationErrors).join(", ")} `;
			state.isDirty = false;
			state.startedAt = undefined;
			state.finishedAt = undefined;
			state.durationMs = undefined;

			// Preserve result from node.result for terminal nodes (passthrough won't run)
			// This allows LLM, ImageGen, etc. to display their results even when validation fails
			if (node?.template.isTerminalNode && node.result) {
				state.result = node.result as unknown as NodeResult;
			} else {
				state.result = null;
			}

			state.version++;
			this.emit("node:error", { nodeId, error: state.error });
		});

		const nodesToInvalidate = new Set<string>();

		if (this.isInitial) {
			this.isInitial = false;
			const dirtyNodes: string[] = [];
			this.nodes.forEach((currNode, id) => {
				const state = this.getOrCreateNodeState(id);

				// Don't clear error if it was set by validation just above
				if (state.status !== TaskStatus.FAILED) {
					state.error = null;
				}

				state.abortController = null;

				// Initialize status based on existing result availability
				if (currNode.result) {
					state.result = currNode.result as unknown as NodeResult;
					state.lastProcessedSignature = this.getNodeValueHash(currNode);
					state.isDirty = false;

					// Only set to COMPLETED if it passed validation (not FAILED)
					if (state.status !== TaskStatus.FAILED) {
						state.status = TaskStatus.COMPLETED;
					}
				} else {
					state.result = null;
					state.lastProcessedSignature = null;
					state.isDirty = true;
					dirtyNodes.push(id);
				}

				// Calculate handle status immediately
				this.updateNodeHandleStatus(id);
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

				// 1. Data/Config Change Detection
				if (!state || state.lastProcessedSignature !== currHash) {
					nodesToInvalidate.add(id);
				}

				// 2. Recovery Detection
				// If a node was previously FAILED (perhaps due to temporary invalid topology during a patch),
				// but is now structurally valid, we must force it to re-evaluate/re-process.
				if (
					state &&
					state.status === TaskStatus.FAILED &&
					!this.graphValidation[id] // It is currently valid
				) {
					// We add it to invalidate so it transitions from FAILED -> QUEUED
					nodesToInvalidate.add(id);
				}

				// Always update handle status on graph update to catch connectivity changes
				this.updateNodeHandleStatus(id);
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
				this.revokeNodeObjectUrls(id);
			}
		});

		// Trigger Execution
		if (nodesToInvalidate.size > 0) {
			this.markNodesDirty(Array.from(nodesToInvalidate));
		}

		this.emit("graph:updated");
	}

	/**
	 * Calculates the visual state (connected, color, type) for all handles of a node.
	 * Performs RUNTIME validation: comparing actual source result types against target handle definition.
	 * Also handles multi-type color inference based on connections.
	 */
	private updateNodeHandleStatus(nodeId: string) {
		const state = this.getOrCreateNodeState(nodeId);
		const handles = this.handles.filter((h) => h.nodeId === nodeId);
		const newStatus: Record<string, HandleState> = {};
		const nodeValidationErrors = this.graphValidation[nodeId] || {};
		const hasNodeErrors = Object.keys(nodeValidationErrors).length > 0;

		for (const handle of handles) {
			let isConnected = false;
			// If handle supports multiple types (e.g. Export Input), default to null (mixed/multi-color)
			// unless we can narrow it down via connection or result.
			let activeType: string | null =
				handle.dataTypes.length === 1 ? (handle.dataTypes[0] as string) : null;

			// Assume valid unless static validation or runtime check fails
			let valid = !nodeValidationErrors[handle.id];

			if (handle.type === "Input") {
				// Check for incoming edge
				const edge = this.edgesByTarget
					.get(nodeId)
					?.find((e) => e.targetHandleId === handle.id);
				isConnected = !!edge;

				if (edge) {
					const sourceState = this.nodeStates.get(edge.source);

					// 1. Try to get type from Runtime Result (Source)
					if (sourceState?.result) {
						const outputIndex = sourceState.result.selectedOutputIndex ?? 0;
						const outputItem = sourceState.result.outputs[
							outputIndex
						]?.items.find((i) => i.outputHandleId === edge.sourceHandleId);

						if (outputItem) {
							activeType = outputItem.type;

							// *** RUNTIME CHECK ***
							if (!handle.dataTypes.includes(activeType as DataType)) {
								valid = false;
							}
						}
					}
					// 2. If no result yet (Graph didn't run), infer from Source Handle Definition
					// This allows 'Export' (Multi) connected to 'Text' (Single) to show 'Text' color immediately.
					else {
						const sourceHandle = this.handles.find(
							(h) => h.id === edge.sourceHandleId,
						);
						if (sourceHandle) {
							// Find intersection of types
							const commonTypes = handle.dataTypes.filter((t) =>
								sourceHandle.dataTypes.includes(t),
							);
							// If we narrowed it down to exactly one type, use it.
							if (commonTypes.length === 1) {
								activeType = commonTypes[0] as string;
							} else if (commonTypes.length > 1) {
								// Still ambiguous (e.g. File -> Export), keep null (Multi) or intersection logic
								// If source is single type (e.g. Image), it dominates.
								if (sourceHandle.dataTypes.length === 1) {
									activeType = sourceHandle.dataTypes[0] as string;
								}
							}
						}
					}
				}
			} else {
				// Output Handle
				// Check if any edge originates from this handle
				const outgoingEdges = this.edges.filter(
					(e) => e.source === nodeId && e.sourceHandleId === handle.id,
				);
				isConnected = outgoingEdges.length > 0;

				// 1. Try to get type from Runtime Result (Self)
				if (state.result) {
					const outputIndex = state.result?.selectedOutputIndex ?? undefined;
					if (outputIndex !== undefined) {
						const outputItem = state.result.outputs[outputIndex]?.items.find(
							(i) => i.outputHandleId === handle.id,
						);
						if (outputItem) {
							activeType = outputItem.type;
						}
					}
				}
				// 2. If no result yet, infer from Downstream Connections (Back-propagation of type constraint)
				// e.g. File (Multi) -> Crop (Image Only). The File output should show Image color.
				else if (isConnected) {
					// Get all target handles this output feeds into
					const targetTypesPerEdge = outgoingEdges
						.map((e) => this.handles.find((h) => h.id === e.targetHandleId))
						.filter((h) => !!h)
						.map((h) => h!.dataTypes);

					if (targetTypesPerEdge.length > 0) {
						// Find intersection of Self Types AND All Connected Target Input Types
						// Start with self types
						let possibleTypes = [...handle.dataTypes];

						// Intersect with each edge's requirement
						for (const targetTypes of targetTypesPerEdge) {
							possibleTypes = possibleTypes.filter((t) =>
								targetTypes.includes(t),
							);
						}

						// If we narrowed it down to exactly one valid type across all connections, use it.
						if (possibleTypes.length === 1) {
							activeType = possibleTypes[0] as string;
						}
					}
				}
			}

			// If the whole node is invalid, outputs are invalid
			// EXCEPTION: If we have a result, we can still show the output as valid/usable
			// This allows LLM nodes to show their generated text even if the prompt input is removed.
			if (handle.type === "Output" && hasNodeErrors && !state.result) {
				valid = false;
			}

			// Resolve Color
			// Requirement: Disconnected = Multi/Null (if multi-type). Connected = Type Color.
			let color: string | null = null;
			if (activeType) {
				const colorConfig = dataTypeColors[activeType] || dataTypeColors.Any;
				color = colorConfig?.hex || "#9ca3af";
			}

			// If we found a specific type via connection/result, we set the color.
			// If activeType is null (because it's unconnected & multi-type, OR connected & ambiguous), color remains null.
			// This allows the frontend to render the multi-color ring.

			// Override: If invalid, we usually want to show the color of the *expected* or *incoming* type to indicate mismatch,
			// or red. But here we assume `valid` flag handles the error UI overlay, and color handles the type indication.

			newStatus[handle.id] = {
				id: handle.id,
				isConnected,
				valid,
				type: activeType,
				color,
			};
		}

		state.handleStatus = newStatus;
	}

	getNodeResult(nodeId: string): NodeResult | null {
		return this.nodeStates.get(nodeId)?.result ?? null;
	}

	getNodeState(nodeId: string): NodeState | null {
		return this.nodeStates.get(nodeId) ?? null;
	}

	getNodeData(nodeId: string): NodeEntityType | undefined {
		return this.nodes.get(nodeId);
	}

	/**
	 * Helper to get the resolved color for a specific handle
	 * Used for coloring edges based on source handle
	 */
	getHandleColor(nodeId: string, handleId: string): string | null {
		const state = this.nodeStates.get(nodeId);
		if (!state) return null;
		return state.handleStatus[handleId]?.color ?? null;
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

	registerProcessor(nodeType: string, processor: NodeRunFunction): void {
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

		// Revoke all object URLs
		this.objectUrls.forEach((urls) => {
			urls.forEach((url) => {
				URL.revokeObjectURL(url);
			});
		});
		this.objectUrls.clear();

		this.removeAllListeners();
	}

	private registerObjectUrl(nodeId: string, url: string): void {
		const urls = this.objectUrls.get(nodeId) || [];
		urls.push(url);
		this.objectUrls.set(nodeId, urls);
	}

	private revokeNodeObjectUrls(nodeId: string): void {
		const urls = this.objectUrls.get(nodeId);
		if (urls) {
			urls.forEach((url) => {
				URL.revokeObjectURL(url);
			});
			this.objectUrls.delete(nodeId);
		}
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
				state.status = TaskStatus.FAILED;
				state.error = `Invalid configuration: ${Object.values(validationErrors).join(", ")} `;
				state.isDirty = false;
				state.startedAt = undefined;
				state.finishedAt = undefined;
				state.durationMs = undefined;

				// Preserve result from node.result for terminal nodes (passthrough won't run)
				// This allows LLM, ImageGen, etc. to display their results even when validation fails
				const node = this.nodes.get(nodeId);
				if (node?.template.isTerminalNode && node.result) {
					state.result = node.result as unknown as NodeResult;
				} else {
					state.result = null;
				}

				// Recalculate inputs even for failed nodes so UI shows current connections
				state.inputs = this.collectInputs(nodeId);

				state.version++;
				this.emit("node:error", { nodeId, error: state.error });
			} else {
				state.isDirty = true;
				state.status = TaskStatus.QUEUED;
				state.error = null;
				state.startedAt = undefined;
				state.finishedAt = undefined;
				state.durationMs = undefined;

				// Immediately recalculate inputs based on current graph topology.
				// This ensures UI components see the current connection state,
				// not stale cached data from previous edges.
				state.inputs = this.collectInputs(nodeId);

				state.version++;

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
					state.result = null; // Clear result on failure
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
		const inputHandles = this.handles.filter(
			(h) => h.nodeId === nodeId && h.type === "Input",
		);

		for (const handle of inputHandles) {
			const edge = this.edgesByTarget
				.get(nodeId)
				?.find((e) => e.targetHandleId === handle.id);
			if (!edge) {
				continue;
			}

			const parentState = this.nodeStates.get(edge.source);
			if (!parentState) return false; // Should not happen if graph consistent

			// If parent is still working, we wait.
			if (
				parentState.isDirty ||
				(parentState.status !== TaskStatus.FAILED &&
					parentState.status !== TaskStatus.COMPLETED)
			) {
				return false;
			}

			// Parent is Settled (FAILED or COMPLETED).
			// We need to decide if we are "Ready" given the parent's outcome.

			// Case 1: Parent Failed or Result Missing
			if (!parentState.result) {
				// If strictly required, we cannot proceed if upstream failed/missing.
				if (handle.required) {
					// If parent Failed -> We block if Required.
					if (parentState.status === TaskStatus.FAILED) return false;
				}
			}
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

		let processor = this.processors.get(node.type);

		if (!processor && this.registry) {
			const entry = this.registry[node.type];
			if (entry) {
				try {
					const module = await entry.browser();
					const PluginImpl = module.default.processor;
					if (PluginImpl) {
						const instance = new PluginImpl();
						processor = instance.process.bind(instance);
						this.processors.set(node.type, processor);
					}
				} catch (e) {
					console.error(`Failed to load processor for ${node.type}`, e);
				}
			}
		}

		if (!processor) {
			state.error = `No processor found for type ${node.type}`;
			state.isDirty = false;
			state.status = TaskStatus.FAILED;
			state.version++;
			this.emit("node:error", { nodeId, error: state.error });
			return;
		}

		state.status = TaskStatus.EXECUTING;
		state.startedAt = Date.now();
		state.error = null;
		state.abortController = new AbortController();

		// Revoke previous object URLs for this node before starting new execution
		this.revokeNodeObjectUrls(nodeId);

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

			this.emit("node:start", { nodeId, inputs, startedAt: state.startedAt });

			const context: NodeProcessorContext = {
				registerObjectUrl: (url: string) => this.registerObjectUrl(nodeId, url),
				getOutputHandle: (type: string, label?: string) => {
					return this.handles.find(
						(h) =>
							h.nodeId === nodeId &&
							h.type === "Output" &&
							(label
								? h.label === label
								: h.dataTypes.includes(type as DataType)),
					)?.id;
				},
				getFirstOutputHandle: (targetNodeId: string, type?: DataType) => {
					return this.handles.find(
						(h) =>
							h.nodeId === targetNodeId &&
							h.type === "Output" &&
							(type ? h.dataTypes.includes(type as DataType) : true),
					)?.id;
				},
				findInputData: (
					inputs: Record<string, ConnectedInput>,
					requiredType?: string,
					handleLabel?: string,
				): string | undefined => {
					const typeToCheck = requiredType ?? "Image";
					for (const [
						handleId,
						{ connectionValid, outputItem },
					] of Object.entries(inputs)) {
						if (!connectionValid || !outputItem) continue;
						if (outputItem.type !== typeToCheck) continue;

						if (handleLabel) {
							const handle = this.handles.find((h) => h.id === handleId);
							if (handle?.label !== handleLabel) continue;
						}

						const fileData = outputItem.data as FileData;
						const url = fileData?.entity
							? GetAssetEndpoint(fileData.entity)
							: fileData?.processData?.dataUrl;
						if (url) return url;
					}
					return undefined;
				},
				pixi: pixiWorkerService as unknown as IPixiProcessor,
			};

			const result = await processor({
				node,
				inputs,
				signal,
				data: node.data,
				context,
			});

			if (signal.aborted) throw new Error("Aborted");

			state.result = result;
			state.isDirty = false;
			state.status = TaskStatus.COMPLETED;
			state.finishedAt = Date.now();
			state.durationMs =
				state.finishedAt - (state.startedAt || state.finishedAt);
			state.lastProcessedSignature = this.getNodeValueHash(node);

			// Recalculate handle status as types might have changed
			this.updateNodeHandleStatus(nodeId);

			// Also update downstream neighbors, as their input handle colors/validity may depend on this result
			const children = this.adjacency.get(nodeId);
			children?.forEach((childId) => {
				this.updateNodeHandleStatus(childId);
			});

			state.version++;

			this.emit("node:processed", {
				nodeId,
				result,
				inputs,
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
				state.status = TaskStatus.QUEUED;
				state.abortController = null;
				state.version++;
				return;
			}

			console.error(`Error processing node ${nodeId}: `, error);

			state.error = error instanceof Error ? error.message : "Unknown error";
			state.isDirty = false; // It processed, but failed.
			state.status = TaskStatus.FAILED;
			state.result = null; // Clear result on failure
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
				status: null,
				result: null,
				inputs: null,
				error: null,
				handleStatus: {},
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
					?.add(`${e.targetHandleId}| ${e.source}| ${e.sourceHandleId} `);
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
				const isParentCompleted = sourceState?.status === TaskStatus.COMPLETED;
				if (isParentCompleted) {
					inputs[handle.id] = {
						connectionValid: true,
						outputItem: null,
					};
				} else {
					if (!handle.required) {
						inputs[handle.id] = {
							connectionValid: true,
							outputItem: null,
						};
					} else {
						inputs[handle.id] = {
							connectionValid: false,
							outputItem: null,
						};
					}
				}
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

			// *** RUNTIME CHECK ***
			// Ensure the actual output type matches the input handle's allowed types.
			// This handles cases where a Source Node handle (e.g. File) allows [Image, Video],
			// but at runtime produces 'Video', and the Destination Node handle only allows [Image].
			const connectionValid = handle.dataTypes.includes(
				outputItem.type as DataType,
			);

			inputs[handle.id] = { connectionValid, outputItem };
		}

		return inputs;
	}
}
