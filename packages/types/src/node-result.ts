import type { DataType, FileAsset } from "@gatewai/db";

export type FileData = {
	entity?: FileAsset;
	dataUrl?: string;
};

export type DataForType<R extends DataType> = R extends "Text"
	? string
	: R extends "Number"
		? number
		: R extends "Boolean"
			? boolean
			: R extends "Image" | "Audio" | "File" | "Mask" | "VideoLayer"
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

export type MultipleOutputResult = {
	selectedOutputIndex: number;
};

// Just to avoid weird gymnastics about typing
export type SingleOutputResult = {
	selectedOutputIndex: 0;
};

export type TextResult = SingleOutputResult & {
	outputs: [{ items: [OutputItem<"Text">] }];
};

export type ToggleResult = SingleOutputResult & {
	outputs: [{ items: [OutputItem<"Boolean">] }];
};

export type FileResult = MultipleOutputResult & {
	outputs: { items: [OutputItem<"File">] }[];
};

export type ImagesResult = MultipleOutputResult & {
	outputs: { items: [OutputItem<"Image">] }[];
};

export type ImageGenResult = ImagesResult;

export type MaskResult = SingleOutputResult & {
	outputs: { items: [OutputItem<"Mask">, OutputItem<"Image">] }[];
};

export type NumberResult = SingleOutputResult & {
	outputs: [{ items: [OutputItem<"Number">] }];
};

export type LLMResult = MultipleOutputResult & {
	outputs: { items: [OutputItem<"Text">] }[];
};

export type ResizeResult = SingleOutputResult & {
	outputs: [{ items: [OutputItem<"Image">] }];
};

export type ModulateResult = SingleOutputResult & {
	outputs: [{ items: [OutputItem<"Image">] }];
};

export type PaintResult = SingleOutputResult & {
	outputs: [
		{
			items:
				| [OutputItem<"Image">, OutputItem<"Mask">]
				| [OutputItem<"Mask">, OutputItem<"Image">];
		},
	];
};

export type BlurResult = SingleOutputResult & {
	outputs: [{ items: [OutputItem<"Image">] }];
};

export type CropResult = SingleOutputResult & {
	outputs: [{ items: [OutputItem<"Image">] }];
};

export type CompositorResult = SingleOutputResult & {
	outputs: [{ items: [OutputItem<"Image">] }];
};

export type AgentOutputUnion =
	| OutputItem<"Video">
	| OutputItem<"Image">
	| OutputItem<"Text">
	| OutputItem<"Number">
	| OutputItem<"Boolean">
	| OutputItem<"Mask">;
export type AgentResult = MultipleOutputResult & {
	outputs: { items: AgentOutputUnion[] }[];
};

export type NodeResult =
	| TextResult
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
	| ThreeDResult
	| PaintResult
	| BlurResult
	| CompositorResult
	| ModulateResult
	| DescriberResult;
