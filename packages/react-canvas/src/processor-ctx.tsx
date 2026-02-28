import { isEqual } from "@gatewai/core";
import {
	GetAssetEndpoint,
	getEnv,
	ResolveFileDataUrl,
} from "@gatewai/core/browser";
import type { FileData, NodeResult } from "@gatewai/core/types";
import {
	makeSelectAllEdges,
	makeSelectAllHandles,
	makeSelectAllNodeEntities,
	type NodeEntityType,
	useAppSelector,
} from "@gatewai/react-store";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
} from "react";
import { NodeGraphProcessor } from "./node-graph-processor";
import { type DiscoveredNodeRegistry, TaskStatus } from "./types";

const ProcessorContext = createContext<NodeGraphProcessor | null>(null);

/**
 * Provider - creates processor instance and syncs with Redux store
 */
export function ProcessorProvider({
	children,
	registry,
}: {
	children: React.ReactNode;
	registry?: DiscoveredNodeRegistry;
}) {
	const processorRef = useRef<NodeGraphProcessor | null>(null);

	if (!processorRef.current) {
		processorRef.current = new NodeGraphProcessor(registry);
	}

	const processor = processorRef.current;
	const nodes = useAppSelector(makeSelectAllNodeEntities);
	const edges = useAppSelector(makeSelectAllEdges);
	const handles = useAppSelector(makeSelectAllHandles);

	// Sync Redux store to processor
	useEffect(() => {
		processor.updateGraph({
			nodes: new Map(
				Object.entries(nodes).filter(
					([, v]) => v.type !== "Note" && v !== undefined,
				) as [string, NodeEntityType][],
			),
			edges,
			handles,
		});
	}, [nodes, edges, processor, handles]);

	// Cleanup on unmount
	useEffect(() => {
		return () => processor.destroy();
	}, [processor]);

	return (
		<ProcessorContext.Provider value={processor}>
			{children}
		</ProcessorContext.Provider>
	);
}

/**
 * Hook to get processor instance
 */
export function useProcessor(): NodeGraphProcessor {
	const processor = useContext(ProcessorContext);
	if (!processor) {
		throw new Error("useProcessor must be used within ProcessorProvider");
	}
	return processor;
}
/**
 * Subscribe to a node's image output for canvas rendering, used by crop etc
 */
export function useNodeOutputs(nodeId: string) {
	const { result } = useNodeResult(nodeId);

	if (!result) return null;

	const output = result.outputs[result.selectedOutputIndex ?? 0];
	return output.items;
}

/**
 * Subscribe to a node's image output for canvas rendering, used by crop etc
 */
export function useNodeFileOutputUrl(nodeId: string): string | null {
	const { result } = useNodeResult(nodeId);

	if (!result) return null;

	const output = result.outputs[result.selectedOutputIndex ?? 0];
	const outputItem = output?.items.find((f) => f.type === "Image");
	if (!outputItem) return null;

	const fileData = outputItem.data as FileData;
	return fileData?.entity
		? ResolveFileDataUrl(fileData?.entity as any)
		: (fileData?.processData?.dataUrl ?? null);
}

const EMPTY_INPUTS = Object.freeze({});
const EMPTY_HANDLES = Object.freeze({});

/**
 * Subscribe to a specific node's result
 * Returns result and updates automatically when processing completes
 */
export function useNodeResult<T extends NodeResult = NodeResult>(
	nodeId: string,
) {
	const processor = useProcessor();

	const snapshotRef = useRef<{
		result: T | null;
		inputs: Record<string, any>;
		handleStatus: Record<string, any>;
		error: string | null;
		isProcessed: boolean;
	} | null>(null);

	const subscribe = (callback: () => void) => {
		const nodeHandler = (data: { nodeId: string }) => {
			if (data.nodeId === nodeId) {
				callback();
			}
		};

		const graphHandler = () => {
			callback();
		};

		processor.on("node:start", nodeHandler);
		processor.on("node:processed", nodeHandler);
		processor.on("node:error", nodeHandler);
		processor.on("node:queued", nodeHandler);
		processor.on("graph:updated", graphHandler);

		return () => {
			processor.off("node:start", nodeHandler);
			processor.off("node:processed", nodeHandler);
			processor.off("node:error", nodeHandler);
			processor.off("node:queued", nodeHandler);
			processor.off("graph:updated", graphHandler);
		};
	};

	const getSnapshot = () => {
		const state = processor.getNodeState(nodeId);

		const nextResult = state?.result ?? null;
		const nextInputs = state?.inputs ?? EMPTY_INPUTS;
		const nextError = state?.error ?? null;
		const nextHandleStatus = state?.handleStatus ?? EMPTY_HANDLES;

		const nextIsProcessed = state?.status === TaskStatus.COMPLETED;

		const hasChanged =
			!snapshotRef.current ||
			snapshotRef.current.result !== nextResult ||
			snapshotRef.current.error !== nextError ||
			snapshotRef.current.handleStatus !== nextHandleStatus ||
			snapshotRef.current.isProcessed !== nextIsProcessed ||
			!isEqual(snapshotRef.current.inputs, nextInputs);

		if (hasChanged) {
			snapshotRef.current = {
				result: nextResult as T,
				inputs: nextInputs,
				handleStatus: nextHandleStatus,
				error: nextError,
				isProcessed: nextIsProcessed,
			};
		}

		return snapshotRef.current!;
	};

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useNodeValidation(nodeId: string): Record<string, string> {
	const processor = useProcessor();
	const lastSnapshot = useRef<Record<string, string>>({});

	const subscribe = useCallback(
		(callback: () => void) => {
			const onValidated = () => callback();
			processor.on("graph:validated", onValidated);
			return () => processor.off("graph:validated", onValidated);
		},
		[processor],
	);

	const getSnapshot = () => {
		const nextValue = processor.getNodeValidation(nodeId) ?? {};

		// Only update the reference if the content actually changed
		if (!isEqual(lastSnapshot.current, nextValue)) {
			lastSnapshot.current = nextValue;
		}

		return lastSnapshot.current;
	};

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEdgeColor(
	sourceNodeId: string,
	sourceHandleId: string,
): string | undefined {
	const processor = useProcessor();
	const lastColor = useRef<string | undefined>(undefined);

	const subscribe = useCallback(
		(callback: () => void) => {
			const handler = (data: { nodeId: string }) => {
				if (data.nodeId === sourceNodeId) {
					callback();
				}
			};
			// Handler for general graph topology updates
			const graphHandler = () => callback();

			processor.on("node:processed", handler);
			processor.on("node:queued", handler);
			processor.on("graph:updated", graphHandler);

			return () => {
				processor.off("node:processed", handler);
				processor.off("node:queued", handler);
				processor.off("graph:updated", graphHandler);
			};
		},
		[processor, sourceNodeId],
	);

	const getSnapshot = () => {
		const color =
			processor.getHandleColor(sourceNodeId, sourceHandleId) ?? undefined;
		if (color !== lastColor.current) {
			lastColor.current = color;
		}
		return lastColor.current;
	};

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useNodePreview(nodeId: string) {
	const processor = useProcessor();
	const { result } = useNodeResult(nodeId);
	const validation = useNodeValidation(nodeId);

	// Subscribe to node updates
	const subscribe = useCallback(
		(callback: () => void) => {
			const handler = () => callback();
			processor.on("graph:updated", handler);
			return () => processor.off("graph:updated", handler);
		},
		[processor],
	);

	const getSnapshot = () => {
		return processor.getNodeData(nodeId);
	};

	const node = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return useMemo(() => {
		const hasInvalidInput = validation && Object.keys(validation).length > 0;
		const isTerminalNode = node?.template?.isTerminalNode;
		const shouldHidePreview = !isTerminalNode && hasInvalidInput;

		const outputItem =
			result?.outputs?.[result?.selectedOutputIndex ?? 0]?.items?.[0];
		const baseUrl = getEnv("VITE_BASE_URL");
		if (!baseUrl || typeof baseUrl !== "string") {
			throw new Error("Invalid base url");
		}

		let mediaUrl: string | null = null;

		if (outputItem) {
			if (
				outputItem.type === "Video" ||
				outputItem.type === "Audio" ||
				outputItem.type === "Lottie" ||
				(outputItem.data &&
					typeof outputItem.data === "object" &&
					"operation" in outputItem.data)
			) {
				const vv =
					outputItem.data as import("@gatewai/core/types").VirtualMediaData;

				// Helper to find the source URL locally avoiding an extra import loop
				const findSourceUrl = (v: any): string | null => {
					if (v?.operation?.op === "source") {
						const source = v.operation.source;
						if (source?.entity)
							return GetAssetEndpoint(source.entity) as string;
						return source?.processData?.dataUrl ?? null;
					}
					if (v?.children?.length > 0) return findSourceUrl(v.children[0]);
					return null;
				};

				mediaUrl = findSourceUrl(vv);
			} else {
				const fileData = outputItem.data as FileData;
				mediaUrl =
					fileData?.processData?.dataUrl ??
					(fileData?.entity ? GetAssetEndpoint(fileData.entity) : null);
			}
		}

		return {
			mediaUrl: shouldHidePreview ? null : mediaUrl,
			node,
			result,
			hasMoreThanOneOutput: (result?.outputs?.length ?? 0) > 1,
		};
	}, [node, result, validation]);
}
