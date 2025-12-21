import { z } from 'zod';

// Text Node
const TextNodeDataSchema = z.object({
  content: z.string().optional(),
}).strict();

// Image Node
const ImageNodeDataSchema = z.object({}).strict();

// File Node
const FileNodeDataSchema = z.object({}).strict();

// Crawler Node
const CrawlerNodeDataSchema = z.object({
  url: z.string().url().optional(),
}).strict();

// Group Node
const GroupNodeDataSchema = z.object({}).strict();

// Agent Node
const AgentNodeDataSchema = z.object({
  prompt: z.string().optional(),
}).strict();

// 3D Node
const ThreeDNodeDataSchema = z.object({}).strict();

// Mask Node
const MaskNodeDataSchema = z.object({}).strict();

// Painter Node
const PainterNodeDataSchema = z.object({
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  size: z.number().int().min(0).max(100).optional(),
  bgColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
}).strict();

// Blur Node
const BlurNodeDataSchema = z.object({
  blurType: z.enum(['Gaussian', 'Box', 'Motion']).optional(),
  size: z.number().min(0).max(10).optional(),
}).strict();

// Compositor Node
const CompositorLayerUpdatesSchema = z.object({
  id: z.number(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  width: z.number(),
  height: z.number(),
  opacity: z.number(),
  blendMode: z.string(),
}).strict();

const CompositorNodeDataSchema = z.object({
  layerUpdates: z.array(CompositorLayerUpdatesSchema).optional(),
}).strict();

// Describer Node
const DescriberNodeDataSchema = z.object({
  prompt: z.string(),
  text: z.string(), // Output
}).strict();

// Router Node
const RouterNodeDataSchema = z.object({
  invert: z.boolean().optional(),
}).strict();

// Array Node
const ArrayNodeDataSchema = z.object({}).strict();

// Resize Node
const ResizeNodeDataSchema = z.object({
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
}).strict();

// Main node schema
const NodeDataSchema = z.union([
  TextNodeDataSchema,
  ImageNodeDataSchema,
  FileNodeDataSchema,
  CrawlerNodeDataSchema,
  GroupNodeDataSchema,
  AgentNodeDataSchema,
  ThreeDNodeDataSchema,
  MaskNodeDataSchema,
  PainterNodeDataSchema,
  BlurNodeDataSchema,
  CompositorNodeDataSchema,
  DescriberNodeDataSchema,
  RouterNodeDataSchema,
  ArrayNodeDataSchema,
  ResizeNodeDataSchema,
]);

// Inferred types
type TextNodeData = z.infer<typeof TextNodeDataSchema>;
type ImageNodeData = z.infer<typeof ImageNodeDataSchema>;
type FileNodeData = z.infer<typeof FileNodeDataSchema>;
type CrawlerNodeData = z.infer<typeof CrawlerNodeDataSchema>;
type GroupNodeData = z.infer<typeof GroupNodeDataSchema>;
type AgentNodeData = z.infer<typeof AgentNodeDataSchema>;
type ThreeDNodeData = z.infer<typeof ThreeDNodeDataSchema>;
type MaskNodeData = z.infer<typeof MaskNodeDataSchema>;
type PainterNodeData = z.infer<typeof PainterNodeDataSchema>;
type BlurNodeData = z.infer<typeof BlurNodeDataSchema>;
type CompositorLayerUpdates = z.infer<typeof CompositorLayerUpdatesSchema>;
type CompositorNodeData = z.infer<typeof CompositorNodeDataSchema>;
type DescriberNodeData = z.infer<typeof DescriberNodeDataSchema>;
type RouterNodeData = z.infer<typeof RouterNodeDataSchema>;
type ArrayNodeData = z.infer<typeof ArrayNodeDataSchema>;
type ResizeNodeData = z.infer<typeof ResizeNodeDataSchema>;
type NodeData = z.infer<typeof NodeDataSchema>;


type AllNodeData =
  | TextNodeData
  | ImageNodeData
  | FileNodeData
  | CrawlerNodeData
  | GroupNodeData
  | AgentNodeData
  | ThreeDNodeData
  | MaskNodeData
  | PainterNodeData
  | BlurNodeData
  | CompositorLayerUpdates
  | CompositorNodeData
  | DescriberNodeData
  | RouterNodeData
  | ArrayNodeData
  | ResizeNodeData
  | NodeData;

export {
  NodeDataSchema,
  TextNodeDataSchema,
  ImageNodeDataSchema,
  FileNodeDataSchema,
  CrawlerNodeDataSchema,
  GroupNodeDataSchema,
  AgentNodeDataSchema,
  ThreeDNodeDataSchema,
  MaskNodeDataSchema,
  PainterNodeDataSchema,
  BlurNodeDataSchema,
  CompositorNodeDataSchema,
  DescriberNodeDataSchema,
  RouterNodeDataSchema,
  ArrayNodeDataSchema,
  ResizeNodeDataSchema,
  CompositorLayerUpdatesSchema,
  type TextNodeData,
  type ImageNodeData,
  type FileNodeData,
  type CrawlerNodeData,
  type GroupNodeData,
  type AgentNodeData,
  type ThreeDNodeData,
  type MaskNodeData,
  type PainterNodeData,
  type BlurNodeData,
  type CompositorLayerUpdates,
  type CompositorNodeData,
  type DescriberNodeData,
  type RouterNodeData,
  type ArrayNodeData,
  type ResizeNodeData,
  type NodeData,
  type AllNodeData,
};

export interface FileDataInterface {
  url: string;
  name: string;
  bucket: string;
  mimeType: string;
  size: number;
}