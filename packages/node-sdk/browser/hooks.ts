import { GetAssetEndpoint } from "@gatewai/core/browser";
import type { FileData, NodeResult } from "@gatewai/core/types";
import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import isEqual from "react-fast-compare";
import { type NodeProcessor, TaskStatus } from "./types.js";
import { useNodeUI } from "./ui.js";

const EMPTY_INPUTS = Object.freeze({});
const EMPTY_HANDLES = Object.freeze({});

/**
 * Subscribe to a specific node's result
 * Returns result and updates automatically when processing completes
 */
export function useNodeResult<T extends NodeResult = NodeResult>(
	nodeId: string,
) {
	const { processor } = useNodeUI();

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
	const { processor } = useNodeUI();
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
	const { processor } = useNodeUI();
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
	const { processor } = useNodeUI();
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
		// @ts-expect-error
		const isTerminalNode = node?.template?.isTerminalNode;
		const shouldHidePreview = !isTerminalNode && hasInvalidInput;

		const outputItem = result?.outputs?.[result?.selectedOutputIndex]?.items[0];
		const inputFileData = outputItem?.data as FileData;

		const imageUrl =
			inputFileData?.processData?.dataUrl ??
			(inputFileData?.entity ? GetAssetEndpoint(inputFileData.entity) : null);

		return {
			imageUrl: shouldHidePreview ? null : imageUrl,
			node,
			result,
			hasMoreThanOneOutput: (result?.outputs?.length ?? 0) > 1,
		};
	}, [node, result, validation]);
}

export function useNodeConfig() {
	const { onNodeConfigUpdate } = useNodeUI();
	return { updateConfig: onNodeConfigUpdate };
}
