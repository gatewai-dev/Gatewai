import { Union } from '../../../../../../../packages/db/generated/client/internal/prismaNamespace';
import type { AgentNodeConfig, ThreeDResult, ArrayNodeConfig, BlurNodeConfig, BlurResult, CompositorNodeConfig, CompositorResult, PainterResult, DescriberNodeData, FileNodeData, FileResult, GPTImage1Data, GPTImage1Result, LLMNodeData, MaskNodeData, MaskResult, NodeWithFileType, PainterNodeData, ResizeNodeData, ResizeResult, RouterNodeData, TextNodeData, TextResult, ThreeDNodeData, ThreeDNodeConfig, MaskNodeConfig, FileNodeConfig, GPTImage1Config, LLMNodeConfig, TextNodeConfig, RouterNodeConfig, PainterNodeConfig } from "@gatewai/types";
import { type Node } from '@xyflow/react';

export type TextNode = Node<NodeWithFileType<TextNodeConfig, TextResult>, 'Text'>;
export type LLMNode = Node<NodeWithFileType<LLMNodeConfig, TextResult>, 'LLM'>;
export type GPTImage1Node = Node<NodeWithFileType<GPTImage1Config, GPTImage1Result>, 'GPTImage1'>;
export type FileNode = Node<NodeWithFileType<FileNodeConfig, FileResult>, 'File'>;
export type AgentNode = Node<NodeWithFileType<AgentNodeConfig>, 'Agent'>;
export type ThreeDNode = Node<NodeWithFileType<ThreeDNodeConfig, ThreeDResult>, 'ThreeD'>;
export type MaskNode = Node<NodeWithFileType<MaskNodeConfig, MaskResult>, 'Mask'>;
export type PainterNode = Node<NodeWithFileType<PainterNodeConfig, PainterResult>, 'Painter'>;
export type BlurNode = Node<NodeWithFileType<BlurNodeConfig, BlurResult>, 'Blur'>;
export type CompositorNode = Node<NodeWithFileType<CompositorNodeConfig, CompositorResult>, 'Compositor'>;
export type RouterNode = Node<NodeWithFileType<RouterNodeConfig>, 'Router'>;
export type ArrayNode = Node<NodeWithFileType<ArrayNodeConfig>, 'Array'>;
export type ResizeNode = Node<NodeWithFileType<ResizeNodeData, ResizeResult>, 'Resize'>;


export type AnyNode =
    TextNode |
    LLMNode |
    GPTImage1Node |
    FileNode |
    AgentNode |
    ThreeDNode |
    MaskNode |
    PainterNode |
    BlurNode |
    CompositorNode |
    RouterNode |
    ArrayNode |
    ResizeNode;