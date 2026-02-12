import type { AnyOutputItem, NodeResult } from "@gatewai/core/types";
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

type ConnectedInput = {
	connectionValid: boolean;
	outputItem: AnyOutputItem | null;
};

type NodeProcessorParams = {
	node: NodeEntityType;
	inputs: Record<string, ConnectedInput>;
	signal: AbortSignal;
};

type NodeProcessor = (
	params: NodeProcessorParams,
) => Promise<NodeResult | null>;

export type {
	ProcessorConfig,
	ConnectedInput,
	NodeProcessor,
	NodeProcessorParams,
};
