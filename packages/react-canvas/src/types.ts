import type { AnyOutputItem, NodeResult } from "@gatewai/core/types";
import type { HandleState, NodeState } from "@gatewai/node-sdk/browser";
import { TaskStatus } from "@gatewai/node-sdk/browser";
import type {
	EdgeEntityType,
	HandleEntityType,
	NodeEntityType,
} from "@gatewai/react-store";

interface ProcessorConfig {
	nodes: Map<string, NodeEntityType>;
	edges: EdgeEntityType[];
	handles: HandleEntityType[];
}

// Re-export types from node-sdk to maintain compatibility within react-canvas
export { TaskStatus };
export type { HandleState, NodeState };

type ConnectedInput = {
	connectionValid: boolean;
	outputItem: AnyOutputItem | null;
};

export interface NodeProcessorContext {
	registerObjectUrl: (url: string) => void;
	getOutputHandle: (type: string, label?: string) => string | undefined;
}

type NodeProcessorParams = {
	node: NodeEntityType;
	inputs: Record<string, ConnectedInput>;
	signal: AbortSignal;
	data: any;
	context: NodeProcessorContext;
};

type NodeRunFunction = (
	params: NodeProcessorParams,
) => Promise<NodeResult | null>;

export type {
	ProcessorConfig,
	ConnectedInput,
	NodeRunFunction,
	NodeProcessorParams,
};
