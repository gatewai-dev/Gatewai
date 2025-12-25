import { z } from 'zod';

// Text Node
const TextNodeConfigSchema = z.object({
  content: z.string().optional(),
}).strict();

// Image Node
const ImageNodeConfigSchema = z.object({}).strict();

// File Node
const FileNodeConfigSchema = z.object({}).strict();
const GPTImage1NodeConfigSchema = z.object({}).strict();

// Crawler Node
const CrawlerNodeConfigSchema = z.object({
  url: z.string().url().optional(),
}).strict();


// Agent Node
const AgentNodeConfigSchema = z.object({
  prompt: z.string().optional(),
}).strict();

// 3D Node
const ThreeDNodeConfigSchema = z.object({}).strict();

// Mask Node
const MaskNodeConfigSchema = z.object({}).strict();

// Painter Node
const PainterNodeConfigSchema = z.object({
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  size: z.number().int().min(0).max(100).optional(),
  bgColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
}).strict();

const BLUR_TYPES = ['Gaussian', 'Box', 'Motion'] as const;
// Blur Node
const BlurNodeConfigSchema = z.object({
  blurType: z.enum(BLUR_TYPES).optional(),
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

const CompositorNodeConfigSchema = z.object({
  layerUpdates: z.array(CompositorLayerUpdatesSchema).optional(),
}).strict();

// Describer Node
const DescriberNodeConfigSchema = z.object({
  prompt: z.string(),
  text: z.string(), // Output
}).strict();

// Router Node
const RouterNodeConfigSchema = z.object({
  invert: z.boolean().optional(),
}).strict();

const LLM_NODE_MODELS = ['xai/grok-4-fast-non-reasoning', 'google/gemini-2.5-flash', 'openai/gpt-5'] as const

const LLMNodeConfigSchema = z.object({
  model: z.enum(LLM_NODE_MODELS)
}).strict();
// Array Node
const ArrayNodeConfigSchema = z.object({}).strict();

// Resize Node
const ResizeNodeConfigSchema = z.object({
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
}).strict();

// Main node schema
const NodeConfigSchema = z.union([
  GPTImage1NodeConfigSchema,
  LLMNodeConfigSchema,
  TextNodeConfigSchema,
  ImageNodeConfigSchema,
  FileNodeConfigSchema,
  CrawlerNodeConfigSchema,
  AgentNodeConfigSchema,
  ThreeDNodeConfigSchema,
  MaskNodeConfigSchema,
  PainterNodeConfigSchema,
  BlurNodeConfigSchema,
  CompositorNodeConfigSchema,
  DescriberNodeConfigSchema,
  RouterNodeConfigSchema,
  ArrayNodeConfigSchema,
  ResizeNodeConfigSchema,
]);

// Inferred types
type TextNodeConfig = z.infer<typeof TextNodeConfigSchema>;
type ImageNodeConfig = z.infer<typeof ImageNodeConfigSchema>;
type LLMNodeConfig = z.infer<typeof LLMNodeConfigSchema>;
type FileNodeConfig = z.infer<typeof FileNodeConfigSchema>;
type CrawlerNodeConfig = z.infer<typeof CrawlerNodeConfigSchema>;
type AgentNodeConfig = z.infer<typeof AgentNodeConfigSchema>;
type ThreeDNodeConfig = z.infer<typeof ThreeDNodeConfigSchema>;
type MaskNodeConfig = z.infer<typeof MaskNodeConfigSchema>;
type PainterNodeConfig = z.infer<typeof PainterNodeConfigSchema>;
type BlurNodeConfig = z.infer<typeof BlurNodeConfigSchema>;
type CompositorLayerUpdates = z.infer<typeof CompositorLayerUpdatesSchema>;
type CompositorNodeConfig = z.infer<typeof CompositorNodeConfigSchema>;
type DescriberNodeConfig = z.infer<typeof DescriberNodeConfigSchema>;
type RouterNodeConfig = z.infer<typeof RouterNodeConfigSchema>;
type ArrayNodeConfig = z.infer<typeof ArrayNodeConfigSchema>;
type ResizeNodeConfig = z.infer<typeof ResizeNodeConfigSchema>;
type AllNodeConfig = z.infer<typeof NodeConfigSchema>;
type GPTImage1Config = z.infer<typeof GPTImage1NodeConfigSchema>;

export {
  NodeConfigSchema,
  TextNodeConfigSchema,
  ImageNodeConfigSchema,
  FileNodeConfigSchema,
  CrawlerNodeConfigSchema,
  AgentNodeConfigSchema,
  ThreeDNodeConfigSchema,
  MaskNodeConfigSchema,
  PainterNodeConfigSchema,
  BlurNodeConfigSchema,
  CompositorNodeConfigSchema,
  DescriberNodeConfigSchema,
  LLMNodeConfigSchema,
  LLM_NODE_MODELS,

  RouterNodeConfigSchema,
  ArrayNodeConfigSchema,
  ResizeNodeConfigSchema,
  CompositorLayerUpdatesSchema,
  type TextNodeConfig,
  type ImageNodeConfig,
  type FileNodeConfig,
  type CrawlerNodeConfig,
  type AgentNodeConfig,
  type ThreeDNodeConfig,
  type LLMNodeConfig,
  type MaskNodeConfig,
  type PainterNodeConfig,
  type BlurNodeConfig,
  type CompositorLayerUpdates,
  type CompositorNodeConfig,
  type DescriberNodeConfig,
  type RouterNodeConfig,
  type ArrayNodeConfig,
  type ResizeNodeConfig,
  type AllNodeConfig,
  type GPTImage1Config,

  BLUR_TYPES,
};