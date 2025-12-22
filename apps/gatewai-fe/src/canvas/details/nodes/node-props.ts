import type { AgentNodeData, ThreeDResult, ArrayNodeData, BlurNodeData, BlurResult, CompositorNodeData, CompositorResult, PainterResult, DescriberNodeData, FileNodeData, FileResult, GPTImage1Data, GPTImage1Result, LLMNodeData, MaskNodeData, MaskResult, NodeWithFileType, PainterNodeData, ResizeNodeData, ResizeResult, RouterNodeData, TextNodeData, TextResult, ThreeDNodeData } from "@gatewai/types";
import { type Node } from '@xyflow/react';

export type TextNode = Node<NodeWithFileType<TextNodeData, TextResult>, 'Text'>;
export type LLMNode = Node<NodeWithFileType<LLMNodeData, TextResult>, 'LLM'>;
export type GPTImage1Node = Node<NodeWithFileType<GPTImage1Data, GPTImage1Result>, 'GPTImage1'>;
export type FileNode = Node<NodeWithFileType<FileNodeData, FileResult>, 'File'>;
export type AgentNode = Node<NodeWithFileType<AgentNodeData>, 'Agent'>;
export type ThreeDNode = Node<NodeWithFileType<ThreeDNodeData, ThreeDResult>, 'ThreeD'>;
export type MaskNode = Node<NodeWithFileType<MaskNodeData, MaskResult>, 'Mask'>;
export type PainterNode = Node<NodeWithFileType<PainterNodeData, PainterResult>, 'Painter'>;
export type BlurNode = Node<NodeWithFileType<BlurNodeData, BlurResult>, 'Blur'>;
export type CompositorNode = Node<NodeWithFileType<CompositorNodeData, CompositorResult>, 'Compositor'>;
export type RouterNode = Node<NodeWithFileType<RouterNodeData>, 'Router'>;
export type ArrayNode = Node<NodeWithFileType<ArrayNodeData>, 'Array'>;
export type ResizeNode = Node<NodeWithFileType<ResizeNodeData, ResizeResult>, 'Resize'>;