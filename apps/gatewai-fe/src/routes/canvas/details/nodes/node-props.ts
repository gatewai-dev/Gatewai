import type {
	AgentNodeConfig,
	AgentResult,
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
	NodeWithFileType,
	PaintNodeConfig,
	PaintResult,
	ResizeNodeData,
	ResizeResult,
	TextNodeConfig,
	TextResult,
	ThreeDNodeConfig,
	ThreeDResult,
} from "@gatewai/types";
import type { Node } from "@xyflow/react";

export type TextNode = Node<
	NodeWithFileType<TextNodeConfig, TextResult>,
	"Text"
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
export type AgentNode = Node<
	NodeWithFileType<AgentNodeConfig, AgentResult>,
	"Agent"
>;
export type ThreeDNode = Node<
	NodeWithFileType<ThreeDNodeConfig, ThreeDResult>,
	"ThreeD"
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
	NodeWithFileType<ResizeNodeData, ResizeResult>,
	"Resize"
>;

export type AnyNode =
	| TextNode
	| LLMNode
	| ImageGenNode
	| FileNode
	| AgentNode
	| ThreeDNode
	| MaskNode
	| PaintNode
	| BlurNode
	| CropNode
	| CompositorNode
	| ResizeNode;
