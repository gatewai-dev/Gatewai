import type { DataType, FileAsset } from "@gatewai/db";

/**
 * Typing for non-terminal processing
 */
export type ProcessData = {
	dataUrl: string;
	/**
	 * Bucket key of temporary file
	 */
	tempKey?: string;
	mimeType?: string;

	// For the Image, Video media types
	width?: number;
	height?: number;

	// For the Audio, Video media types
	duration?: number;
	fps?: number;
};

export type FileData = {
	entity?: FileAsset;
	processData?: ProcessData;
};

export type DataForType<R extends DataType> = R extends "Text"
	? string
	: R extends "Number"
		? number
		: R extends "Boolean"
			? boolean
			: R extends "Image" | "Audio" | "Video" | "VideoLayer"
				? FileData
				: R extends "Any"
					? string | number | boolean | FileData
					: never;

export type OutputItem<R extends DataType> = {
	type: R;
	data: DataForType<R>;
	outputHandleId: string | undefined;
};

export type Output = {
	items: OutputItem<DataType>[];
};

export type SingleOutputGeneric<T extends DataType> = {
	selectedOutputIndex: 0;
	outputs: [{ items: [OutputItem<T>] }];
};

export type MultiOutputGeneric<T extends DataType> = {
	selectedOutputIndex: number;
	outputs: [{ items: [OutputItem<T>] }];
};

export type TextResult = SingleOutputGeneric<"Text">;
export type ToggleResult = SingleOutputGeneric<"Boolean">;

export type FileResult =
	| MultiOutputGeneric<"Video">
	| MultiOutputGeneric<"Image">
	| MultiOutputGeneric<"Audio">;

export type ImagesResult = MultiOutputGeneric<"Image">;

export type ImageGenResult = ImagesResult;

export type MaskResult = {
	selectedOutputIndex: 0;
	outputs: { items: [OutputItem<"Image">, OutputItem<"Image">] }[];
};

export type NumberResult = SingleOutputGeneric<"Number">;

export type LLMResult = MultiOutputGeneric<"Text">;

export type ResizeResult = SingleOutputGeneric<"Image">;

export type ModulateResult = SingleOutputGeneric<"Image">;

export type PaintResult = {
	selectedOutputIndex: 0;
	outputs: [
		{
			items: [OutputItem<"Image">, OutputItem<"Image">];
		},
	];
};

export type BlurResult = SingleOutputGeneric<"Image">;
export type CropResult = SingleOutputGeneric<"Image">;

export type CompositorResult = SingleOutputGeneric<"Image">;
export type VideoCompositorResult = SingleOutputGeneric<"Video">;
export type TextMergerResult = SingleOutputGeneric<"Text">;

export type BaseVideoGenResult = MultiOutputGeneric<"Video">;

export type VideoGenResult = BaseVideoGenResult;
export type VideoGenExtendResult = BaseVideoGenResult;
export type VideoGenFirstLastFrameResult = BaseVideoGenResult;

export type TextToSpeechResult = MultiOutputGeneric<"Audio">;
export type SpeechToTextResult = MultiOutputGeneric<"Text">;

export type AnyOutputUnion =
	| OutputItem<"Video">
	| OutputItem<"Image">
	| OutputItem<"Audio">
	| OutputItem<"Text">
	| OutputItem<"Number">
	| OutputItem<"Boolean">;

/**
 * Export result may have
 */
export type ExportResult = {
	selectedOutputIndex: number;
	outputs: { items: AnyOutputUnion[] }[];
};

export type AnyOutputItem =
	| OutputItem<"Audio">
	| OutputItem<"Text">
	| OutputItem<"Boolean">
	| OutputItem<"Image">
	| OutputItem<"Video">
	| OutputItem<"Number">;

export type NodeResult =
	| TextResult
	| TextMergerResult
	| ToggleResult
	| FileResult
	| ImagesResult
	| ImageGenResult
	| CropResult
	| MaskResult
	| NumberResult
	| LLMResult
	| ResizeResult
	| PaintResult
	| BlurResult
	| CompositorResult
	| ModulateResult
	| VideoGenResult
	| VideoGenExtendResult
	| VideoGenFirstLastFrameResult
	| VideoCompositorResult
	| ExportResult
	| TextToSpeechResult
	| SpeechToTextResult;
