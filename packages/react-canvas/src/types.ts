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

export enum TaskStatus {
	QUEUED = "QUEUED",
	EXECUTING = "EXECUTING",
	FAILED = "FAILED",
	COMPLETED = "COMPLETED",
}

export interface HandleState {
	id: string;
	isConnected: boolean;
	valid: boolean;
	type: string | null;
	color: string | null;
}

export interface NodeState {
	id: string;
	status: TaskStatus | null;
	isDirty: boolean;
	startedAt?: number;
	finishedAt?: number;
	durationMs?: number;
	result: NodeResult | null;
	inputs: Record<string, ConnectedInput> | null;
	error: string | null;
	handleStatus: Record<string, HandleState>;
	abortController: AbortController | null;
	lastProcessedSignature: string | null;
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
	HandleState,
	ConnectedInput,
	NodeProcessor,
	NodeProcessorParams,
};
