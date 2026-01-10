import type { PrismaClient, Task } from "@gatewai/db";
import type { NodeResult } from "@gatewai/types";
import type { CanvasCtxData } from "../../repositories/canvas.js";

export type NodeProcessorCtx = {
	node: CanvasCtxData["nodes"][number];
	data: CanvasCtxData & {
		tasks: Task[];
	};
	prisma: PrismaClient;
};

export type NodeProcessor = (
	ctx: NodeProcessorCtx,
) => Promise<{ success: boolean; error?: string; newResult?: NodeResult }>;
