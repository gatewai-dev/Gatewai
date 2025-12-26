import type { EdgeEntityType } from "@/store/edges";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import type { NodeType } from "@gatewai/db";
import type { NodeResult } from "@gatewai/types";

import blurNodeProcessor, { type BlurExtraArgs } from './blur';
import resizeProcessor, { type ResizeExtraArgs } from "./resize";

export type CanvasCtxData = {
  nodes: NodeEntityType[];
  edges: EdgeEntityType[];
  handles: HandleEntityType[];
}

export type NodeProcessorCtx<T> = {
  node: NodeEntityType
  data: CanvasCtxData;
  extraArgs: T
}

type NodeProcessorExtraArgs = BlurExtraArgs | ResizeExtraArgs;

export type NodeProcessor<T> = (ctx: NodeProcessorCtx<T>) => Promise<{ success: boolean, error?: string, newResult?: NodeResult }>;

const browserNodeProcessors: Partial<Record<NodeType, NodeProcessor<NodeProcessorExtraArgs>>> = {
  Resize: resizeProcessor as NodeProcessor<ResizeExtraArgs>,
  Blur: blurNodeProcessor as NodeProcessor<BlurExtraArgs>,
}

export { browserNodeProcessors }