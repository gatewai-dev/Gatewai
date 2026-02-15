import { isEqual } from "@gatewai/core";
import type { FileResult, NodeResult } from "@gatewai/core/types";
import {
	NodeUIContext,
	type NodeUIContextType,
	NodeUIProvider,
	useNodeResult,
} from "@gatewai/node-sdk/browser";
import {
	type HandleEntityType,
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
import { useCanvasCtx } from "./canvas-ctx";
import { NodeGraphProcessor } from "./node-graph-processor";
import { BaseNode } from "./nodes/base";
import { CanvasRenderer } from "./nodes/common/canvas-renderer";
import { useNodeTaskRunning } from "./task-manager-ctx";
import {
	type ConnectedInput,
	type DiscoveredNodeRegistry,
	type HandleState,
	TaskStatus,
} from "./types";

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
	const { onNodeConfigUpdate, onNodeResultUpdate } = useCanvasCtx();

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

	const { createNewHandle, runNodes } = useCanvasCtx();

	const uiContextValue: NodeUIContextType = useMemo(
		() => ({
			onNodeConfigUpdate,
			onNodeResultUpdate,
			createNewHandle,
			runNodes,
			useNodeTaskRunning, // Imported from task-manager-ctx
			BaseNode,
			CanvasRenderer,
			processor,
		}),
		[
			onNodeConfigUpdate,
			onNodeResultUpdate,
			createNewHandle,
			runNodes,
			processor,
		],
	);

	return (
		<ProcessorContext.Provider value={processor}>
			<NodeUIProvider value={uiContextValue}>{children}</NodeUIProvider>
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
export {
	useEdgeColor,
	useNodePreview,
	useNodeValidation,
} from "@gatewai/node-sdk/browser";

export { useNodeResult };

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
