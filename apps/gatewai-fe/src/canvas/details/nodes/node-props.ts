import type { AgentNodeData, ArrayNodeData, BlurNodeData, CompositorNodeData, CrawlerNodeData, DescriberNodeData, FileNodeData, GPTImage1Data, LLMNodeData, MaskNodeData, NodeWithFileType, PainterNodeData, ResizeNodeData, RouterNodeData, TextNodeData, ThreeDNodeData } from "@gatewai/types";
import { type Node } from '@xyflow/react';

export type TextNode = Node<NodeWithFileType<TextNodeData>, 'Text'>;
export type LLMNode = Node<NodeWithFileType<LLMNodeData>, 'LLM'>;
export type GPTImage1Node = Node<NodeWithFileType<GPTImage1Data>, 'GPTImage1'>;
export type FileNode = Node<NodeWithFileType<FileNodeData>, 'File'>;
export type CrawlerNode = Node<NodeWithFileType<CrawlerNodeData>, 'Crawler'>;
export type AgentNode = Node<NodeWithFileType<AgentNodeData>, 'Agent'>;
export type ThreeDNode = Node<NodeWithFileType<ThreeDNodeData>, 'ThreeD'>;
export type MaskNode = Node<NodeWithFileType<MaskNodeData>, 'Mask'>;
export type PainterNode = Node<NodeWithFileType<PainterNodeData>, 'Painter'>;
export type BlurNode = Node<NodeWithFileType<BlurNodeData>, 'Blur'>;
export type CompositorNode = Node<NodeWithFileType<CompositorNodeData>, 'Compositor'>;
export type DescriberNode = Node<NodeWithFileType<DescriberNodeData>, 'Describer'>;
export type RouterNode = Node<NodeWithFileType<RouterNodeData>, 'Router'>;
export type ArrayNode = Node<NodeWithFileType<ArrayNodeData>, 'Array'>;
export type ResizeNode = Node<NodeWithFileType<ResizeNodeData>, 'Resize'>;