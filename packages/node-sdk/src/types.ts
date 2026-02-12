import type { EnvConfig } from "@gatewai/core";
import type { NodeResult } from "@gatewai/core/types";
import type {
	Canvas,
	DataType,
	Edge,
	Handle,
	Node,
	NodeTemplate,
	PrismaClient,
	Task,
} from "@gatewai/db";
import { type ZodTypeAny, z } from "zod";

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
 * Represents a connected input value for a frontend processor.
 */
export interface FrontendConnectedInput {
	connectionValid: boolean;
	outputItem: {
		type: DataType;
		data: unknown;
		outputHandleId: string | undefined;
	} | null;
}

/**
 * Parameters passed to a frontend node processor.
 */
export interface FrontendNodeProcessorParams {
	node: {
		id: string;
		type: string;
		config: unknown;
		result: unknown;
		[key: string]: unknown;
	};
	inputs: Record<string, FrontendConnectedInput>;
	signal: AbortSignal;
}

/**
 * Frontend processor function signature.
 * Used for lightweight client-side processing (e.g., blur preview, crop, resize).
 */
export type FrontendNodeProcessor = (
	params: FrontendNodeProcessorParams,
) => Promise<NodeResult | null>;

// ─── Node Manifest ──────────────────────────────────────────────────────────

const HandleDefinitionSchema = z.object({
	dataTypes: z.custom<DataType[]>(),
	label: z.string(),
	required: z.boolean().optional(),
	order: z.number(),
	description: z.string().optional(),
});

/**
 * Metadata defining the interface and identity of a node.
 * This is safe to import in any environment.
 */
export const NodeMetadataSchema = z.object({
	// Identity
	type: z.string().min(1),
	displayName: z.string().min(1),
	description: z.string().optional(),
	category: z.string().min(1),
	subcategory: z.string().optional(),
	showInQuickAccess: z.boolean().optional(),
	showInSidebar: z.boolean().optional(),

	// I/O Contract
	handles: z.object({
		inputs: z.array(HandleDefinitionSchema),
		outputs: z.array(HandleDefinitionSchema),
	}),
	variableInputs: z
		.object({
			enabled: z.boolean(),
			dataTypes: z.custom<DataType[]>(),
		})
		.optional(),
	variableOutputs: z
		.object({
			enabled: z.boolean(),
			dataTypes: z.custom<DataType[]>(),
		})
		.optional(),

	// Execution Flags
	isTerminal: z.boolean(),
	isTransient: z.boolean().optional(),

	// Config
	configSchema: z.custom<ZodTypeAny>().optional(),
	defaultConfig: z.record(z.unknown()).optional(),
});

export type NodeMetadata = z.infer<typeof NodeMetadataSchema>;

/**
 * Backend-specific plugin definition.
 */
export interface BackendNodePlugin extends NodeMetadata {
	backendProcessor: NodeProcessorConstructor;
}

/**
 * Frontend-specific plugin definition.
 */
export interface FrontendNodePlugin extends NodeMetadata {
	frontendProcessor?: FrontendNodeProcessor;
	Component: any; // React component
	ConfigComponent?: any; // React component
}

/**
 * Legacy combined manifest.
 * @deprecated Use split metadata/node/client exports instead.
 */
export const NodeManifestSchema = NodeMetadataSchema.extend({
	backendProcessor: z.custom<NodeProcessorConstructor>().optional(),
	frontendProcessor: z.custom<FrontendNodeProcessor>().optional(),
});

export type GatewaiNodeManifest = z.infer<typeof NodeManifestSchema>;
