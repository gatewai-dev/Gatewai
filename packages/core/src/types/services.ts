import type { DataType } from "@gatewai/db";
import type { FileData } from "./index.js";
import type { IPixiProcessor } from "./pixi.js";

/**
 * Interface that class-based node processors must implement.
 */
export interface NodeProcessorResult {
	success: boolean;
	error?: string;
	newResult?: unknown;
}

export interface NodeProcessor {
	process(ctx: unknown): Promise<NodeProcessorResult>;
}

/**
 * Interface for graph resolution services.
 * Used to resolve input/output values during node execution.
 */
export interface GraphResolvers<T = unknown> {
	getInputValue: (
		data: T,
		targetNodeId: string,
		required: boolean,
		options: { dataType?: DataType; label?: string },
	) => {
		type: DataType;
		data: unknown;
		outputHandleId: string | undefined;
	} | null;

	getInputValuesByType: (
		data: T,
		targetNodeId: string,
		options: { dataType?: DataType; label?: string },
	) => Array<{
		type: DataType;
		data: unknown;
		outputHandleId: string | undefined;
	} | null>;

	getAllOutputHandles: (
		data: T,
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
		data: T,
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
}

/**
 * Interface for media processing and handling.
 */
export interface MediaService {
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
}

/**
 * Interface for AI provider services.
 * Used by AI nodes (LLM, ImageGen, VideoGen, TTS, STT) via DI.
 */
export interface AIProvider {
	getGemini<T>(): T;
}
