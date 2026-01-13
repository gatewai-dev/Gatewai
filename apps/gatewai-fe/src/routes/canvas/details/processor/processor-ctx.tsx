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
import { NodeGraphProcessor } from "./node-graph-processor";
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
	error: string | null;
} {
	const processor = useProcessor();

	// Track the snapshot in a ref to ensure stable identity
	const snapshotRef = useRef<{
		result: T | null;
		inputs: Record<HandleEntityType["id"], ConnectedInput>;
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

		return () => {
			processor.off("node:start", handler);
			processor.off("node:processed", handler);
			processor.off("node:error", handler);
		};
	};

	const getSnapshot = () => {
		const state = processor.getNodeState(nodeId);

		const nextResult = state?.result ?? null;
		const nextInputs = state?.inputs ?? {};
		const nextError = state?.error ?? null;

		// Check if anything actually changed since the last snapshot
		const hasChanged =
			!snapshotRef.current ||
			snapshotRef.current.result !== nextResult ||
			snapshotRef.current.error !== nextError ||
			// If inputs is an object/map, compare size or specific keys
			!isEqual(snapshotRef.current.inputs, nextInputs);

		if (hasChanged) {
			snapshotRef.current = {
				result: nextResult as T,
				inputs: nextInputs,
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
