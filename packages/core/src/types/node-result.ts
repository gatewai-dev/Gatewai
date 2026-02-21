import type { DataType, FileAsset } from "@gatewai/db";
import z from "zod";
import type { VirtualVideoData } from "./video/virtual-video.js";

/**
 * Typing for non-terminal processing
 */
export const ProcessDataSchema = z.object({
	dataUrl: z.string(),
	/**
	 * Bucket key of temporary file
	 */
	tempKey: z.string().optional(),
	mimeType: z.string().optional(),

	// For the Image, Video media types
	width: z.number().optional(),
	height: z.number().optional(),

	// For the Audio, Video media types
	duration: z.number().optional(),
	fps: z.number().optional(),
});

export type ProcessData = z.infer<typeof ProcessDataSchema>;

export const FileDataSchema = z.object({
	entity: z.custom<FileAsset>().optional(),
	processData: ProcessDataSchema.optional(),
});

export type FileData = z.infer<typeof FileDataSchema>;

export type DataForType<R extends DataType> = R extends "Text"
	? string
	: R extends "Number"
		? number
		: R extends "Boolean"
			? boolean
			: R extends "Image" | "Audio"
				? FileData
				: R extends "Video"
					? VirtualVideoData
					: R extends "Any"
						? string | number | boolean | FileData | VirtualVideoData
						: never;

export const OutputItemSchema = z.object({
	type: z.custom<DataType>(),
	data: z.any(), // Since DataForType is complex, we just allow any at runtime but type it properly if possible.
	outputHandleId: z.string().optional(),
});

// Utility to create strictly-typed output item schemas
export const createOutputItemSchema = <T extends DataType>(
	type: z.ZodLiteral<T>,
	dataSchema: z.ZodTypeAny,
) => {
	return z.object({
		type: type,
		data: dataSchema,
		outputHandleId: z.string().optional(),
	}) as z.ZodType<OutputItem<T>>;
};

export type OutputItem<R extends DataType> = {
	type: R;
	data: DataForType<R>;
	outputHandleId: string | undefined;
};

export type Output = {
	items: OutputItem<DataType>[];
};

export const SingleOutputGenericSchema = <T extends DataType>(
	outputItemSchema: z.ZodType<OutputItem<T>>,
) =>
	z.object({
		selectedOutputIndex: z.literal(0),
		outputs: z.tuple([z.object({ items: z.tuple([outputItemSchema]) })]),
	});

export type SingleOutputGeneric<T extends DataType> = {
	selectedOutputIndex: 0;
	outputs: [{ items: [OutputItem<T>] }];
};

export const MultiOutputGenericSchema = <T extends DataType>(
	outputItemSchema: z.ZodType<OutputItem<T>>,
) =>
	z.object({
		selectedOutputIndex: z.number(),
		outputs: z.tuple([z.object({ items: z.tuple([outputItemSchema]) })]),
	});

export type MultiOutputGeneric<T extends DataType> = {
	selectedOutputIndex: number;
	outputs: [{ items: [OutputItem<T>] }];
};

export type AnyOutputItem =
	| OutputItem<"Audio">
	| OutputItem<"Text">
	| OutputItem<"Boolean">
	| OutputItem<"Image">
	| OutputItem<"Video">
	| OutputItem<"Number">;

export type AnyOutputUnion =
	| OutputItem<"Video">
	| OutputItem<"Image">
	| OutputItem<"Audio">
	| OutputItem<"Text">
	| OutputItem<"Number">
	| OutputItem<"Boolean">;

export const AnyOutputUnionSchema = z.object({
	type: z.custom<DataType>(),
	data: z.any(),
	outputHandleId: z.string().optional(),
}) as z.ZodType<AnyOutputUnion>;

export const NodeResultSchema = z.object({
	selectedOutputIndex: z.number(),
	outputs: z.array(
		z.object({
			items: z.array(AnyOutputUnionSchema),
		}),
	),
});

export type NodeResult = z.infer<typeof NodeResultSchema>;
