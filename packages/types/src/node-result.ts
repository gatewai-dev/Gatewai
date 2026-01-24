import { z } from "zod";
import { DataTypes } from "./base.js";

// --- Base Schemas ---

export const ProcessDataSchema = z.object({
	dataUrl: z.string(),
	tempKey: z.string().optional(),
	mimeType: z.string().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
	duration: z.number().optional(),
	fps: z.number().optional(),
});

// Assuming FileAsset is a complex type, we use z.any() or a placeholder
// Replace z.any() with the actual FileAsset schema if available
export const FileDataSchema = z.object({
	entity: z.any().optional(),
	processData: ProcessDataSchema.optional(),
});

// --- Dynamic Data Typing ---

export const DataForTypeSchema = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	FileDataSchema,
]);

export const OutputItemSchema = z.object({
	type: z.enum(DataTypes),
	data: DataForTypeSchema,
	outputHandleId: z.string().optional(),
});

// --- Generic Result Factories ---

const SingleOutputGeneric = <T extends z.ZodTypeAny>(itemSchema: T) =>
	z.object({
		selectedOutputIndex: z.literal(0),
		outputs: z.tuple([
			z.object({
				items: z.tuple([itemSchema]),
			}),
		]),
	});

const MultiOutputGeneric = <T extends z.ZodTypeAny>(itemSchema: T) =>
	z.object({
		selectedOutputIndex: z.number(),
		outputs: z.array(
			z.object({
				items: z.tuple([itemSchema]),
			}),
		),
	});

// --- Specific Node Results ---

export const TextResultSchema = SingleOutputGeneric(
	OutputItemSchema.extend({ type: z.literal("Text"), data: z.string() }),
);
export const NumberResultSchema = SingleOutputGeneric(
	OutputItemSchema.extend({ type: z.literal("Number"), data: z.number() }),
);
export const ToggleResultSchema = SingleOutputGeneric(
	OutputItemSchema.extend({ type: z.literal("Boolean"), data: z.boolean() }),
);

const ImageItem = OutputItemSchema.extend({
	type: z.literal("Image"),
	data: FileDataSchema,
});
const AudioItem = OutputItemSchema.extend({
	type: z.literal("Audio"),
	data: FileDataSchema,
});
const VideoItem = OutputItemSchema.extend({
	type: z.literal("Video"),
	data: FileDataSchema,
});

export const ImageResultSchema = MultiOutputGeneric(ImageItem);
export const AudioResultSchema = MultiOutputGeneric(AudioItem);
export const VideoResultSchema = MultiOutputGeneric(VideoItem);

export const FileResultSchema = z.union([
	VideoResultSchema,
	ImageResultSchema,
	AudioResultSchema,
]);

export const MaskResultSchema = z.object({
	selectedOutputIndex: z.literal(0),
	outputs: z.array(
		z.object({
			items: z.tuple([ImageItem, ImageItem]),
		}),
	),
});

export const PaintResultSchema = z.object({
	selectedOutputIndex: z.literal(0),
	outputs: z.tuple([
		z.object({
			items: z.tuple([ImageItem, ImageItem]),
		}),
	]),
});

export const ExportResultSchema = z.object({
	selectedOutputIndex: z.number(),
	outputs: z.array(
		z.object({
			items: z.array(
				z.union([
					VideoItem,
					ImageItem,
					AudioItem,
					TextResultSchema,
					NumberResultSchema,
					ToggleResultSchema,
				]),
			),
		}),
	),
});

// --- Final Union Schema ---

export const NodeResultSchema = z.union([
	TextResultSchema,
	NumberResultSchema,
	ToggleResultSchema,
	FileResultSchema,
	MaskResultSchema,
	PaintResultSchema,
	ExportResultSchema,
	// Mapping specific tool names to their underlying schemas
	MultiOutputGeneric(
		OutputItemSchema.extend({ type: z.literal("Text"), data: z.string() }),
	), // LLMResult
	SingleOutputGeneric(ImageItem), // Resize, Blur, Crop, Compositor
	MultiOutputGeneric(VideoItem), // VideoGen
	MultiOutputGeneric(AudioItem), // TTS
]);

// --- Exported Types ---

export type ProcessData = z.infer<typeof ProcessDataSchema>;
export type FileData = z.infer<typeof FileDataSchema>;
export type OutputItem = z.infer<typeof OutputItemSchema>;
export type NodeResult = z.infer<typeof NodeResultSchema>;
