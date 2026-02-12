import type { FileResult, NodeResult } from "@gatewai/core/types";
import {
	type HandleEntityType,
	makeSelectAllEdges,
	makeSelectAllHandles,
	makeSelectAllNodeEntities,
	type NodeEntityType,
	useAppSelector,
} from "@gatewai/react-store";
import { isEqual } from "lodash";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
} from "react";
import { NodeUIContext } from "../../../../../../../packages/node-sdk/client/ui";
import { useCanvasCtx } from "../../../../../../../packages/react-canvas/src/canvas-ctx";
import { useNodePreview } from "../hooks/node-preview";
import { BaseNode } from "../nodes/base";
import { CanvasRenderer } from "../nodes/common/canvas-renderer";
import {
	type HandleState,
	NodeGraphProcessor,
	TaskStatus,
} from "./node-graph-processor";
import type { ConnectedInput } from "./types";

const ProcessorContext = createContext<NodeGraphProcessor | null>(null);

/**
 * Provider - creates processor instance and syncs with Redux store
 */
export function ProcessorProvider({ children }: { children: React.ReactNode }) {
	const processorRef = useRef<NodeGraphProcessor | null>(null);
	const { onNodeConfigUpdate, onNodeResultUpdate } = useCanvasCtx();

	if (!processorRef.current) {
		processorRef.current = new NodeGraphProcessor();
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

	const uiContextValue = useMemo(
		() => ({
			onNodeConfigUpdate,
			onNodeResultUpdate,
			useNodePreview,
			useNodeResult,
			useNodeValidation,
			BaseNode,
			CanvasRenderer,
		}),
		[onNodeConfigUpdate, onNodeResultUpdate],
	);

	return (
		<ProcessorContext.Provider value={processor}>
			<NodeUIContext.Provider value={uiContextValue as any}>
				{children}
			</NodeUIContext.Provider>
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

const EMPTY_INPUTS = Object.freeze({});
const EMPTY_HANDLES = Object.freeze({});

/**
 * Subscribe to a specific node's result
 * Returns result and updates automatically when processing completes
 */
export function useNodeResult<T extends NodeResult = NodeResult>(
	nodeId: string,
): {
	result: T | null;
	inputs: Record<HandleEntityType["id"], ConnectedInput>;
	handleStatus: Record<string, HandleState>;
	error: string | null;
	isProcessed: boolean; // Added property
} {
	const processor = useProcessor();

	const snapshotRef = useRef<{
		result: T | null;
		inputs: Record<HandleEntityType["id"], ConnectedInput>;
		handleStatus: Record<string, HandleState>;
		error: string | null;
		isProcessed: boolean; // Added property
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

		// Logic for isProcessed: adjust 'processed' to match your actual state enum
		const nextIsProcessed = state?.status === TaskStatus.COMPLETED;

		const hasChanged =
			!snapshotRef.current ||
			snapshotRef.current.result !== nextResult ||
			snapshotRef.current.error !== nextError ||
			snapshotRef.current.handleStatus !== nextHandleStatus ||
			snapshotRef.current.isProcessed !== nextIsProcessed || // Check for change
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
		const nextValue = processor.getNodeValidation(nodeId);

		// Only update the reference if the content actually changed
		if (!isEqual(lastSnapshot.current, nextValue)) {
			lastSnapshot.current = nextValue;
		}

		return lastSnapshot.current;
	};

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hook to get the color for an edge based on its source handle
 */
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

	const fileData =
		outputItem.data as FileResult["outputs"][number]["items"][number]["data"];
	return fileData?.entity?.signedUrl ?? fileData?.processData?.dataUrl ?? null;
}
