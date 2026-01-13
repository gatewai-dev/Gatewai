import type { FileResult, NodeResult } from "@gatewai/types";
import { isEqual } from "lodash";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useSyncExternalStore,
} from "react";
import { useAppSelector } from "@/store";
import { makeSelectAllEdges } from "@/store/edges";
import { type HandleEntityType, makeSelectAllHandles } from "@/store/handles";
import { makeSelectAllNodeEntities, type NodeEntityType } from "@/store/nodes";
import { type HandleState, NodeGraphProcessor } from "./node-graph-processor";
import type { ConnectedInput } from "./types";

const ProcessorContext = createContext<NodeGraphProcessor | null>(null);

/**
 * Provider - creates processor instance and syncs with Redux store
 */
export function ProcessorProvider({ children }: { children: React.ReactNode }) {
	const processorRef = useRef<NodeGraphProcessor | null>(null);

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
} {
	const processor = useProcessor();

	// Track the snapshot in a ref to ensure stable identity
	const snapshotRef = useRef<{
		result: T | null;
		inputs: Record<HandleEntityType["id"], ConnectedInput>;
		handleStatus: Record<string, HandleState>;
		error: string | null;
	} | null>(null);

	const subscribe = (callback: () => void) => {
		const handler = (data: { nodeId: string }) => {
			if (data.nodeId === nodeId) {
				// Force a recalculation of the snapshot before calling the callback
				callback();
			}
		};

		processor.on("node:start", handler);
		processor.on("node:processed", handler);
		processor.on("node:error", handler);
		processor.on("node:queued", handler); // Status changes
		// Graph update indirectly triggers these, but we might want to be explicit if topology changes without execution
		// Note: The processor doesn't currently emit a "graph:updated" event that is public,
		// but React rerenders will re-run this hook.
		// However, for useSyncExternalStore we need an event.
		// The processor updates state synchronously in updateGraph so the component should re-render if it uses
		// this hook and the data changed.
		// We'll rely on the parent component triggering re-renders via Redux updates, which calls updateGraph,
		// but since useSyncExternalStore is outside React's flow, we ideally need an event.
		// Let's assume 'node:queued' or similar covers it or we rely on React prop updates to the Provider triggering the effect.
		// To be safe, we can listen to a generic change if available, or just the node events.
		// Since updateGraph marks nodes dirty/queued, 'node:queued' should fire.

		return () => {
			processor.off("node:start", handler);
			processor.off("node:processed", handler);
			processor.off("node:error", handler);
			processor.off("node:queued", handler);
		};
	};

	const getSnapshot = () => {
		const state = processor.getNodeState(nodeId);

		const nextResult = state?.result ?? null;
		const nextInputs = state?.inputs ?? {};
		const nextError = state?.error ?? null;
		const nextHandleStatus = state?.handleStatus ?? {};

		// Check if anything actually changed since the last snapshot
		const hasChanged =
			!snapshotRef.current ||
			snapshotRef.current.result !== nextResult ||
			snapshotRef.current.error !== nextError ||
			snapshotRef.current.handleStatus !== nextHandleStatus ||
			// If inputs is an object/map, compare size or specific keys
			!isEqual(snapshotRef.current.inputs, nextInputs);

		if (hasChanged) {
			snapshotRef.current = {
				result: nextResult as T,
				inputs: nextInputs,
				handleStatus: nextHandleStatus,
				error: nextError,
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
			processor.on("node:processed", handler);
			// Also need to listen to initial graph loads or status updates
			processor.on("node:queued", handler);
			return () => {
				processor.off("node:processed", handler);
				processor.off("node:queued", handler);
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
