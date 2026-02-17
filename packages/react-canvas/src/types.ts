import type {
	ConnectedInput,
	NodeProcessorContext,
	NodeProcessorParams,
	NodeRunFunction,
} from "@gatewai/core/types";
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

// Re-export specific types from core that differ or are used here
export type {
	ConnectedInput,
	NodeProcessorContext,
	NodeProcessorParams,
	NodeRunFunction,
};

import type { NodeMetadata } from "@gatewai/core";
import type { FrontendNodePlugin } from "@gatewai/node-sdk/browser";
import type { BackendNodePlugin } from "@gatewai/node-sdk/server";

export type DiscoveredNodeEntry = {
	metadata: () => Promise<{ metadata: Readonly<NodeMetadata> }>;
	browser: () => Promise<{ default: Readonly<FrontendNodePlugin> }>;
	server: () => Promise<{ default: Readonly<BackendNodePlugin> }>;
};

export type DiscoveredNodeRegistry = Record<string, DiscoveredNodeEntry>;

export type { ProcessorConfig };
