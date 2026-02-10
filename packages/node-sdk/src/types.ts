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
import type { IPixiProcessor } from "@gatewai/pixi-processor";
import type { FileData, NodeResult } from "@gatewai/types";
import { type ZodTypeAny, z } from "zod";

/**
 * Input filter options used by graph resolver functions.
 */
export interface InputFilterOptions {
	dataType?: DataType;
	label?: string;
}

/**
 * Services injected into backend node processors by the host application.
 * This is the DI contract that decouples processors from app-level imports.
 */
export interface NodeServices {
	getInputValue: (
		data: BackendNodeProcessorCtx["data"],
		targetNodeId: string,
		required: boolean,
		options: InputFilterOptions,
	) => {
		type: DataType;
		data: unknown;
		outputHandleId: string | undefined;
	} | null;

	getInputValuesByType: (
		data: BackendNodeProcessorCtx["data"],
		targetNodeId: string,
		options: InputFilterOptions,
	) => Array<{
		type: DataType;
		data: unknown;
		outputHandleId: string | undefined;
	} | null>;

	getAllOutputHandles: (
		data: BackendNodeProcessorCtx["data"],
		nodeId: string,
	) => Array<{
		id: string;
		type: string;
		nodeId: string;
		dataTypes: DataType[];
		label: string;
		[key: string]: unknown;
	}>;

	getAllInputValuesWithHandle: (
		data: BackendNodeProcessorCtx["data"],
		targetNodeId: string,
	) => Array<{
		handle:
			| {
					id: string;
					type: string;
					nodeId: string;
					dataTypes: DataType[];
					label: string;
					[key: string]: unknown;
			  }
			| undefined;
		value: {
			type: DataType;
			data: unknown;
			outputHandleId: string | undefined;
		} | null;
	}>;

	loadMediaBuffer: (fileData: FileData) => Promise<Buffer>;

	getFileDataMimeType: (fileData: FileData) => Promise<string | null>;

	// ── Storage ───────────────────────────────────────────────────────────────

	uploadToTemporaryFolder: (
		buffer: Buffer,
		mimeType: string,
		key: string,
	) => Promise<{ signedUrl: string; key: string }>;

	uploadToGCS: (
		buffer: Buffer,
		key: string,
		contentType: string,
		bucketName: string,
	) => Promise<void>;

	generateSignedUrl: (
		key: string,
		bucketName: string,
		expiresIn?: number,
	) => Promise<string>;

	getFromGCS: (key: string, bucket?: string) => Promise<Buffer>;

	// ── Media Processing ──────────────────────────────────────────────────────

	/** Backend pixi service for image transformations */
	backendPixiService: IPixiProcessor;

	getImageDimensions: (
		buffer: Buffer,
	) =>
		| Promise<{ width: number; height: number }>
		| { width: number; height: number };

	getImageBuffer: (imageInput: FileData) => Promise<Buffer>;

	resolveFileDataUrl: (
		data: FileData | null,
	) => string | Promise<string | null> | null;

	bufferToDataUrl: (buffer: Buffer, mimeType: string) => string;

	env: {
		DEBUG_LOG_MEDIA: boolean;
		GCS_ASSETS_BUCKET: string;
		GEMINI_API_KEY: string;
	};
}

/**
 * Data context passed to a backend node processor during execution.
 * Contains the full canvas state, task info, database client, and injected services.
 */
export interface BackendNodeProcessorCtx {
	/** The node instance being processed */
	node: Node & { result: unknown; config: unknown };
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
	/** Prisma database client for direct DB access */
	prisma: PrismaClient;
	/** Injected services from the host application */
	services: NodeServices;
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
 * Backend processor function signature.
 * Receives the execution context (including injected services) and returns a result.
 */
export type BackendNodeProcessor = (
	ctx: BackendNodeProcessorCtx,
) => Promise<BackendNodeProcessorResult>;

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

export const NodeManifestSchema = z.object({
	// Identity
	type: z.string().min(1),
	displayName: z.string().min(1),
	description: z.string().optional(),
	category: z.string().min(1),
	subcategory: z.string().optional(),
	version: z.string().min(1),
	showInQuickAccess: z.boolean().optional(),

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

	// Execution
	isTerminal: z.boolean(),
	isTransient: z.boolean().optional(),

	// Config
	configSchema: z.custom<ZodTypeAny>().optional(),
	defaultConfig: z.record(z.unknown()).optional(),

	// Processing
	backendProcessor: z.custom<BackendNodeProcessor>().optional(),
	frontendProcessor: z.custom<FrontendNodeProcessor>().optional(),
});

/**
 * The complete manifest for a Gatewai node plugin.
 *
 * This is the single export contract a node package needs to implement.
 * The core engine reads this manifest to register the node's processors,
 * template, UI components, and configuration.
 */
export type GatewaiNodeManifest = z.infer<typeof NodeManifestSchema>;
