import type { DataType, FileAsset } from "@gatewai/db";

export type ProcessData = {
	dataUrl: string;

	// For the Image, Video media types
	width?: number;
	height?: number;

	// For the Audio, Video media types
	duration?: number;
	dps?: number;
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
			: R extends "Image" | "Audio" | "File" | "Mask" | "Video" | "VideoLayer"
				? FileData
				: R extends "DesignLayer"
					? string | FileData
					: R extends "VideoLayer"
						? FileData
						: R extends "Any"
							? string | number | boolean | FileData
							: never;

export type OutputItem<R extends DataType> = {
	type: R;
	data: DataForType<R>;
	outputHandleId: string;
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

export type FileResult = MultiOutputGeneric<"File">;

export type ImagesResult = MultiOutputGeneric<"Image">;

export type ImageGenResult = ImagesResult;

export type MaskResult = {
	selectedOutputIndex: 0;
	outputs: { items: [OutputItem<"Mask">, OutputItem<"Image">] }[];
};

export type NumberResult = SingleOutputGeneric<"Number">;

export type LLMResult = MultiOutputGeneric<"Text">;

export type ResizeResult = SingleOutputGeneric<"Image">;

export type ModulateResult = SingleOutputGeneric<"Image">;

export type PaintResult = {
	selectedOutputIndex: 0;
	outputs: [
		{
			items:
				| [OutputItem<"Image">, OutputItem<"Mask">]
				| [OutputItem<"Mask">, OutputItem<"Image">];
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

export type AgentOutputUnion =
	| OutputItem<"Video">
	| OutputItem<"Image">
	| OutputItem<"Audio">
	| OutputItem<"Text">
	| OutputItem<"Number">
	| OutputItem<"Boolean">
	| OutputItem<"Mask">;

export type AgentResult = {
	selectedOutputIndex: number;
	outputs: { items: AgentOutputUnion[] }[];
};

export type AnyOutputItem =
	| OutputItem<"Audio">
	| OutputItem<"Text">
	| OutputItem<"Boolean">
	| OutputItem<"File">
	| OutputItem<"Image">
	| OutputItem<"Video">
	| OutputItem<"Mask">
	| OutputItem<"Number">;

export type NodeResult =
	| TextResult
	| TextMergerResult
	| ToggleResult
	| FileResult
	| ImagesResult
	| ImageGenResult
	| AgentResult
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
	| TextToSpeechResult
	| SpeechToTextResult;
