import type {
	EdgeEntityType,
	HandleEntityType,
	NodeEntityType,
} from "@gatewai/react-store";
import type { AnyOutputItem, NodeResult } from "@gatewai/types";

interface ProcessorConfig {
	nodes: Map<string, NodeEntityType>;
	edges: EdgeEntityType[];
	handles: HandleEntityType[];
}

interface NodeState {
	id: string;
	isDirty: boolean;
	isProcessing: boolean;
	result: NodeResult | null;
	error: string | null;
	abortController: AbortController | null;
	lastProcessedSignature: string | null;
	inputs: Record<string, ConnectedInput> | null;
	version: number;
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
	NodeState,
	ConnectedInput,
	NodeProcessor,
	NodeProcessorParams,
};
