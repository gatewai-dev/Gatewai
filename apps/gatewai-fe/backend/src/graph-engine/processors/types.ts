import type { EnvConfig } from "@gatewai/core";
import type {
	GraphResolvers,
	MediaService,
	NodeResult,
	StorageService,
} from "@gatewai/core/types";
import type { CanvasCtxData, CanvasCtxDataWithTasks } from "@gatewai/data-ops";
import type { PrismaClient } from "@gatewai/db";

export type NodeProcessorCtx = {
	node: CanvasCtxData["nodes"][number];
	data: CanvasCtxDataWithTasks;
	prisma: PrismaClient;
	graph: GraphResolvers;
	storage: StorageService;
	media: MediaService;
	env: EnvConfig;
};

export type NodeProcessor = (
	ctx: NodeProcessorCtx,
) => Promise<{ success: boolean; error?: string; newResult?: NodeResult }>;
