import type { PrismaClient } from "@gatewai/db";
import type { NodeResult } from "@gatewai/types";
import type {
	CanvasCtxData,
	CanvasCtxDataWithTasks,
} from "../../data-access/canvas.js";

export type NodeProcessorCtx = {
	node: CanvasCtxData["nodes"][number];
	data: CanvasCtxDataWithTasks;
	prisma: PrismaClient;
};

export type NodeProcessor = (
	ctx: NodeProcessorCtx,
) => Promise<{ success: boolean; error?: string; newResult?: NodeResult }>;
