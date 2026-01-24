import type { DataType } from "@gatewai/db";
import { z } from "zod";
import { FileAssetSchema } from "./base.js";

export const ProcessDataSchema = z.object({
	dataUrl: z.string(),
	tempKey: z.string().optional(),
	mimeType: z.string().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
	duration: z.number().optional(),
	fps: z.number().optional(),
});

export const FileDataSchema = z.object({
	entity: FileAssetSchema.optional(),
	processData: ProcessDataSchema.optional(),
});

const createOutputItem = <T extends DataType>(
	type: T,
	dataSchema: z.ZodTypeAny,
) =>
	z.object({
		type: z.literal(type),
		data: dataSchema,
		outputHandleId: z.string().optional(),
	});

const ImageItem = createOutputItem("Image", FileDataSchema);
const VideoItem = createOutputItem("Video", FileDataSchema);
const AudioItem = createOutputItem("Audio", FileDataSchema);
const TextItem = createOutputItem("Text", z.string());
const NumberItem = createOutputItem("Number", z.number());
const BooleanItem = createOutputItem("Boolean", z.boolean());

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
		outputs: z.tuple([
			z.object({
				items: z.tuple([itemSchema]),
			}),
		]),
	});

// --- Specific Node Results ---

export const TextResultSchema = SingleOutputGeneric(TextItem);
export const ToggleResultSchema = SingleOutputGeneric(BooleanItem);
export const NumberResultSchema = SingleOutputGeneric(NumberItem);

export const TextMergerResultSchema = TextResultSchema;
export const SpeechToTextResultSchema = MultiOutputGeneric(TextItem);
export const LLMResultSchema = MultiOutputGeneric(TextItem);

export const ImagesResultSchema = MultiOutputGeneric(ImageItem);
export const ImageGenResultSchema = ImagesResultSchema;
export const ResizeResultSchema = SingleOutputGeneric(ImageItem);
export const BlurResultSchema = SingleOutputGeneric(ImageItem);
export const CropResultSchema = SingleOutputGeneric(ImageItem);
export const CompositorResultSchema = SingleOutputGeneric(ImageItem);
export const ModulateResultSchema = SingleOutputGeneric(ImageItem);

export const BaseVideoGenResultSchema = MultiOutputGeneric(VideoItem);
export const VideoGenResultSchema = BaseVideoGenResultSchema;
export const VideoGenExtendResultSchema = BaseVideoGenResultSchema;
export const VideoGenFirstLastFrameResultSchema = BaseVideoGenResultSchema;
export const VideoCompositorResultSchema = SingleOutputGeneric(VideoItem);

export const TextToSpeechResultSchema = MultiOutputGeneric(AudioItem);

export const FileResultSchema = z.union([
	MultiOutputGeneric(VideoItem),
	MultiOutputGeneric(ImageItem),
	MultiOutputGeneric(AudioItem),
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

export const AnyOutputUnionSchema = z.union([
	VideoItem,
	ImageItem,
	AudioItem,
	TextItem,
	NumberItem,
	BooleanItem,
]);

export const ExportResultSchema = z.object({
	selectedOutputIndex: z.number(),
	outputs: z.array(
		z.object({
			items: z.array(AnyOutputUnionSchema),
		}),
	),
});

// --- Final Union Schema ---

export const NodeResultSchema = z.union([
	TextResultSchema,
	TextMergerResultSchema,
	ToggleResultSchema,
	FileResultSchema,
	ImagesResultSchema,
	ImageGenResultSchema,
	CropResultSchema,
	MaskResultSchema,
	NumberResultSchema,
	LLMResultSchema,
	ResizeResultSchema,
	PaintResultSchema,
	BlurResultSchema,
	CompositorResultSchema,
	ModulateResultSchema,
	VideoGenResultSchema,
	VideoGenExtendResultSchema,
	VideoGenFirstLastFrameResultSchema,
	VideoCompositorResultSchema,
	ExportResultSchema,
	TextToSpeechResultSchema,
	SpeechToTextResultSchema,
]);

// --- Exported Types ---

export type ProcessData = z.infer<typeof ProcessDataSchema>;
export type FileData = z.infer<typeof FileDataSchema>;
export type AnyOutputItem = z.infer<typeof AnyOutputUnionSchema>;

export type TextResult = z.infer<typeof TextResultSchema>;
export type TextMergerResult = z.infer<typeof TextMergerResultSchema>;
export type ToggleResult = z.infer<typeof ToggleResultSchema>;
export type NumberResult = z.infer<typeof NumberResultSchema>;
export type LLMResult = z.infer<typeof LLMResultSchema>;

export type ImagesResult = z.infer<typeof ImagesResultSchema>;
export type ImageGenResult = z.infer<typeof ImageGenResultSchema>;
export type FileResult = z.infer<typeof FileResultSchema>;
export type MaskResult = z.infer<typeof MaskResultSchema>;
export type PaintResult = z.infer<typeof PaintResultSchema>;

export type ResizeResult = z.infer<typeof ResizeResultSchema>;
export type BlurResult = z.infer<typeof BlurResultSchema>;
export type CropResult = z.infer<typeof CropResultSchema>;
export type CompositorResult = z.infer<typeof CompositorResultSchema>;
export type ModulateResult = z.infer<typeof ModulateResultSchema>;

export type VideoGenResult = z.infer<typeof VideoGenResultSchema>;
export type VideoGenExtendResult = z.infer<typeof VideoGenExtendResultSchema>;
export type VideoGenFirstLastFrameResult = z.infer<
	typeof VideoGenFirstLastFrameResultSchema
>;
export type VideoCompositorResult = z.infer<typeof VideoCompositorResultSchema>;

export type TextToSpeechResult = z.infer<typeof TextToSpeechResultSchema>;
export type SpeechToTextResult = z.infer<typeof SpeechToTextResultSchema>;
export type ExportResult = z.infer<typeof ExportResultSchema>;

export type NodeResult = z.infer<typeof NodeResultSchema>;
