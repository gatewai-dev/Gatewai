import type { NodeResult } from "@gatewai/core/types";
import type {
	Canvas,
	DataType,
	Edge,
	Handle,
	Node,
	NodeTemplate,
	Task,
} from "@gatewai/db";

/**
 * Input filter options used by graph resolver functions.
 */
export interface InputFilterOptions {
	dataType?: DataType;
	label?: string;
}

import type {
	GraphResolvers,
	MediaService,
	StorageService,
} from "@gatewai/core/types";

// Re-export so consumers don't need to import from @gatewai/core/types directly if they don't want to
export type { GraphResolvers, MediaService, StorageService };

/**
 * Data context passed to a backend node processor during execution.
 * Contains the full canvas state, task info, database client, and injected services.
 */
export interface BackendNodeProcessorCtx {
	/** The node instance being processed */
	node: Node & { result: unknown; config: unknown; template: NodeTemplate };
	/** Full canvas context including nodes, edges, handles, tasks */
	data: {
		canvas: Canvas;
		nodes: Array<Node & { template: NodeTemplate }>;
		edges: Array<Edge>;
		handles: Array<Handle>;
		tasks: Array<Task>;
		task?: Task;
		apiKey?: string;
	};
}

/**
 * Result returned by a backend node processor.
 */
export interface BackendNodeProcessorResult {
	success: boolean;
	error?: string;
	newResult?: NodeResult;
}

/**
 * Interface that class-based node processors must implement.
 */
export interface NodeProcessor {
	process(ctx: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult>;
}

/**
 * Type alias for a class constructor implementing NodeProcessor.
 */
export type NodeProcessorConstructor = new (...args: any[]) => NodeProcessor;

/**
 * Backend-specific plugin definition.
 */
export interface BackendNodePlugin extends NodeMetadata {
	backendProcessor: NodeProcessorConstructor;
}
