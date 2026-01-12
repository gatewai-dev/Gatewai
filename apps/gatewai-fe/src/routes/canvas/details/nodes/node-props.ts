import type {
	BlurNodeConfig,
	BlurResult,
	CompositorNodeConfig,
	CompositorResult,
	CropNodeConfig,
	CropResult,
	FileNodeConfig,
	FileResult,
	ImageGenConfig,
	ImageGenResult,
	LLMNodeConfig,
	MaskNodeConfig,
	MaskResult,
	NodeResult,
	NodeWithFileType,
	NoteNodeConfig,
	PaintNodeConfig,
	PaintResult,
	PreviewNodeConfig,
	ResizeNodeConfig,
	ResizeResult,
	TextMergerNodeConfig,
	TextMergerResult,
	TextNodeConfig,
	TextResult,
	VideoCompositorNodeConfig,
	VideoCompositorResult,
} from "@gatewai/types";
import type { Node } from "@xyflow/react";

export type TextNode = Node<
	NodeWithFileType<TextNodeConfig, TextResult>,
	"Text"
>;
export type TextMergerNode = Node<
	NodeWithFileType<TextMergerNodeConfig, TextMergerResult>,
	"Text"
>;
export type PreviewNode = Node<
	NodeWithFileType<PreviewNodeConfig, NodeResult>,
	"Preview"
>;
export type VideoCompositorNode = Node<
	NodeWithFileType<VideoCompositorNodeConfig, VideoCompositorResult>,
	"VideoCompositor"
>;
export type LLMNode = Node<NodeWithFileType<LLMNodeConfig, TextResult>, "LLM">;
export type ImageGenNode = Node<
	NodeWithFileType<ImageGenConfig, ImageGenResult>,
	"ImageGen"
>;
export type FileNode = Node<
	NodeWithFileType<FileNodeConfig, FileResult>,
	"File"
>;
export type MaskNode = Node<
	NodeWithFileType<MaskNodeConfig, MaskResult>,
	"Mask"
>;
export type PaintNode = Node<
	NodeWithFileType<PaintNodeConfig, PaintResult>,
	"Paint"
>;
export type BlurNode = Node<
	NodeWithFileType<BlurNodeConfig, BlurResult>,
	"Blur"
>;
export type CropNode = Node<
	NodeWithFileType<CropNodeConfig, CropResult>,
	"Crop"
>;
export type CompositorNode = Node<
	NodeWithFileType<CompositorNodeConfig, CompositorResult>,
	"Compositor"
>;
export type ResizeNode = Node<
	NodeWithFileType<ResizeNodeConfig, ResizeResult>,
	"Resize"
>;

export type NoteNode = Node<
	NodeWithFileType<NoteNodeConfig, NodeResult>,
	"Note"
>;

export type SpeechToTextNode = Node<
	NodeWithFileType<NoteNodeConfig, NodeResult>,
	"Note"
>;

export type AnyNode =
	| TextNode
	| LLMNode
	| ImageGenNode
	| FileNode
	| MaskNode
	| NoteNode
	| PaintNode
	| BlurNode
	| CropNode
	| CompositorNode
	| ResizeNode
	| VideoCompositorNode
	| TextMergerNode;
