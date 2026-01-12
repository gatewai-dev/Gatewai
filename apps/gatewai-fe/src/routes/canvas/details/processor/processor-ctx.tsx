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
import { imageStore } from "./image-store";
import { NodeGraphProcessor, TaskStatus } from "./node-graph-processor";
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
 * Subscribe to a specific node's processing state, including result, inputs, status, error, and validation
 * Returns a comprehensive meta state and updates automatically on relevant events
 */
export function useNodeResult<T extends NodeResult = NodeResult>(
	nodeId: string,
): {
	result: T | null;
	inputs: Record<HandleEntityType["id"], ConnectedInput>;
	isProcessing: boolean;
	error: string | null;
	validation: Record<string, string>;
} {
	const processor = useProcessor();

	// Track the snapshot in a ref to ensure stable identity
	const snapshotRef = useRef<{
		result: T | null;
		inputs: Record<HandleEntityType["id"], ConnectedInput>;
		isProcessing: boolean;
		error: string | null;
		validation: Record<string, string>;
	} | null>(null);

	const subscribe = (callback: () => void) => {
		const handler = (data: { nodeId: string }) => {
			if (data.nodeId === nodeId) {
				callback();
			}
		};

		processor.on("node:start", handler);
		processor.on("node:processed", handler);
		processor.on("node:error", handler);
		processor.on("node:validated", handler);

		return () => {
			processor.off("node:start", handler);
			processor.off("node:processed", handler);
			processor.off("node:error", handler);
			processor.off("node:validated", handler);
		};
	};

	const getSnapshot = () => {
		const state = processor.getNodeState(nodeId);

		const nextResult = state?.result ?? null;
		const nextInputs = state?.inputs ?? {};
		const nextIsProcessing = state?.status === TaskStatus.EXECUTING ?? false;
		const nextError = state?.error ?? null;
		const nextValidation = processor.getNodeValidation(nodeId);

		// Check if anything actually changed since the last snapshot
		const hasChanged =
			!snapshotRef.current ||
			snapshotRef.current.result !== nextResult ||
			snapshotRef.current.isProcessing !== nextIsProcessing ||
			snapshotRef.current.error !== nextError ||
			!isEqual(snapshotRef.current.inputs, nextInputs) ||
			!isEqual(snapshotRef.current.validation, nextValidation);

		if (hasChanged) {
			snapshotRef.current = {
				result: nextResult as T,
				inputs: nextInputs,
				isProcessing: nextIsProcessing,
				error: nextError,
				validation: nextValidation,
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
			const onValidated = (data: { nodeId: string }) => {
				if (data.nodeId === nodeId) callback();
			};
			processor.on("node:validated", onValidated);
			return () => processor.off("node:validated", onValidated);
		},
		[processor, nodeId],
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

/**
 * Trigger manual processing of a node
 */
export function useProcessNode(nodeId: string) {
	const processor = useProcessor();
	return () => processor.processNode(nodeId);
}

export function useNodeResultHash(nodeId: string): string | null {
	const processor = useProcessor();

	const subscribe = (callback: () => void) => {
		const onProcessed = (data: { nodeId: string }) => {
			if (data.nodeId === nodeId) callback();
		};
		const onStart = (data: { nodeId: string }) => {
			if (data.nodeId === nodeId) callback();
		};
		const onError = (data: { nodeId: string }) => {
			if (data.nodeId === nodeId) callback();
		};

		processor.on("node:start", onStart);
		processor.on("node:processed", onProcessed);
		processor.on("node:error", onError);

		return () => {
			processor.off("node:start", onStart);
			processor.off("node:processed", onProcessed);
			processor.off("node:error", onError);
		};
	};

	const getSnapshot = () => {
		return imageStore.getHashForNode(nodeId) ?? null;
	};

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
