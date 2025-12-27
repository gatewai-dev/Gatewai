import { z } from 'zod';

// Text Node
const TextNodeConfigSchema = z.object({
  content: z.string().optional(),
}).strict();


// File Node
const FileNodeConfigSchema = z.object({}).strict();

const IMAGEGEN_NODE_MODELS = [
  'google/gemini-3-pro-image',
  'google/gemini-2.5-flash-image',
  'openai/gpt-5'
] as const
const ImageGenNodeConfigSchema = z.object({
  model: z.enum(IMAGEGEN_NODE_MODELS),
}).strict();

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

// Blur Node
const BlurNodeConfigSchema = z.object({
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

const LLM_NODE_MODELS = [
  'openai/gpt-5-chat',
  'openai/gpt-5-pro',
  'openai/gpt-5.1-instant',
  'openai/gpt-5.1-thinking',
  'xai/grok-4',
  'xai/grok-4.1-fast-reasoning',
  'xai/grok-4.1-fast-non-reasoning',
  'anthropic/claude-opus-4.5',
  'anthropic/claude-haiku-4.5',
  'anthropic/claude-opus-4.1',
  'anthropic/claude-opus-4',
  'perplexity/sonar-pro',
  'perplexity/sonar',
  'perplexity/sonar-reasoning',
  'amazon/nova-pro',
  'meta/llama-3.3-70b',
  'deepseek/deepseek-v3.2',
] as const

const LLMNodeConfigSchema = z.object({
  model: z.enum(LLM_NODE_MODELS),
  temperature: z.number().min(0).max(2).optional().default(0),
}).strict();
// Array Node
const ArrayNodeConfigSchema = z.object({}).strict();

// Resize Node
const ResizeNodeConfigSchema = z.object({
  originalWidth: z.number().int().positive().optional(),
  originalHeight: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  maintainAspect: z.boolean().optional(),
}).strict();

// Main node schema
const NodeConfigSchema = z.union([
  ImageGenNodeConfigSchema,
  LLMNodeConfigSchema,
  TextNodeConfigSchema,
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
type ImageGenConfig = z.infer<typeof ImageGenNodeConfigSchema>;

export {
  NodeConfigSchema,
  TextNodeConfigSchema,
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
  RouterNodeConfigSchema,
  ArrayNodeConfigSchema,
  ResizeNodeConfigSchema,
  CompositorLayerUpdatesSchema,
  type TextNodeConfig,
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
  type ImageGenConfig,
  LLM_NODE_MODELS,
  IMAGEGEN_NODE_MODELS,
};