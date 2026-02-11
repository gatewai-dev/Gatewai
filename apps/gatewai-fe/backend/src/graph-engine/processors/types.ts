import type { CanvasCtxData, CanvasCtxDataWithTasks } from "@gatewai/data-ops";
import type {
	NodeResult,
} from "@gatewai/types";

export type NodeProcessorCtx = {
	node: CanvasCtxData["nodes"][number];
	data: CanvasCtxDataWithTasks;
};

export type NodeProcessor = (
	ctx: NodeProcessorCtx,
) => Promise<{ success: boolean; error?: string; newResult?: NodeResult }>;
