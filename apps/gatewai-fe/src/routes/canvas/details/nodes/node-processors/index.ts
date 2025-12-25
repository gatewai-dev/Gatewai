import type { EdgeEntityType } from "@/store/edges";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import type { NodeType } from "@gatewai/db";
import type { NodeResult } from "@gatewai/types";

import blurNodeProcessor from './blur';

export type CanvasCtxData = {
    nodes: NodeEntityType[];
    edges: EdgeEntityType[];
    handles: HandleEntityType[];
}

export type NodeProcessorCtx = {
  node: NodeEntityType
  data: CanvasCtxData;
}

export type NodeProcessor = (ctx: NodeProcessorCtx) => Promise<{ success: boolean, error?: string, newResult?: NodeResult }>;

const browserNodeProcessors: Partial<Record<NodeType, NodeProcessor>> = {
    ["Blur"]: blurNodeProcessor,
}

export { browserNodeProcessors }