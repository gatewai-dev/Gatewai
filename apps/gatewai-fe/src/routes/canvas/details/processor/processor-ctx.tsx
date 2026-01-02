import type { AnyOutputItem, FileResult, NodeResult } from "@gatewai/types";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
} from "react";
import { useAppSelector } from "@/store";
import { makeSelectAllEdges } from "@/store/edges";
import { makeSelectAllHandles } from "@/store/handles";
import { makeSelectAllNodeEntities, type NodeEntityType } from "@/store/nodes";
import { NodeGraphProcessor } from "./node-graph-processor";

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
	inputs: Map<
		string,
		{ connectionValid: boolean; outputItem: AnyOutputItem | null }
	>;
	isProcessing: boolean;
	error: string | null;
} {
	const processor = useProcessor();

	const subscribe = (callback: () => void) => {
		const onProcessed = (data: { nodeId: string }) => {
			if (data.nodeId === nodeId) callback();
		};
		const onStart = (data: {
			nodeId: string;
			inputs: Map<
				string,
				{ connectionValid: boolean; outputItem: AnyOutputItem | null }
			>;
		}) => {
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
		const state = processor.getNodeState(nodeId);

		const inputsAsArray = state?.inputs
			? Array.from(state.inputs.entries())
			: [];

		return JSON.stringify({
			result: state?.result ?? null,
			inputs: inputsAsArray,
			isProcessing: state?.isProcessing ?? false,
			error: state?.error ?? null,
		});
	};

	const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return useMemo(() => {
		const parsed = JSON.parse(snapshot);
		return {
			...parsed,
			inputs: new Map(parsed.inputs),
		};
	}, [snapshot]);
}

// A simple deep equality helper (or use lodash.isEqual)
const isDeepEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

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
		if (!isDeepEqual(lastSnapshot.current, nextValue)) {
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
