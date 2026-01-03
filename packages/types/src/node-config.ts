import { z } from "zod";

// Text Node
const TextNodeConfigSchema = z
	.object({
		content: z.string().optional(),
	})
	.strict();

// File Node
const FileNodeConfigSchema = z.object({}).strict();

const IMAGEGEN_NODE_MODELS = [
	"google/gemini-3-pro-image", // Nano banana pro
	"google/gemini-2.5-flash-image", // Nano banana
] as const;

const ImageGenNodeConfigSchema = z
	.object({
		model: z.enum(IMAGEGEN_NODE_MODELS),
	})
	.strict();

// 3D Node
const PreviewNodeConfigSchema = z.object({}).strict();

// Mask Node
const MaskNodeConfigSchema = z.object({}).strict();

// Paint Node
const PaintNodeConfigSchema = z
	.object({
		width: z.number().int(),
		height: z.number().int(),
		maintainAspect: z.boolean(),
		backgroundColor: z
			.string()
			.regex(/^#[0-9A-F]{6}$/i)
			.optional(),
		paintData: z.string().optional(),
	})
	.strict();

const BlurNodeConfigSchema = z
	.object({
		size: z.number().min(0).max(10).optional(),
	})
	.strict();

const ModulateNodeConfigSchema = z
	.object({
		// Hue is an additive rotation in degrees.
		// 0 to 360 is standard, though sharp allows any number (it wraps).
		hue: z.number().min(0).max(360).default(0),

		// Saturation is a multiplier.
		// 1.0 is identity. 0 is grayscale. 2.0 is double saturation.
		saturation: z.number().min(0).max(10).default(1),

		// Lightness is a multiplier on the L channel (perceptual).
		// 1.0 is identity. 0 is black.
		lightness: z.number().min(0).max(10).default(1),

		// Brightness is a multiplier on the final RGB result.
		// 1.0 is identity. 0 is black.
		brightness: z.number().min(0).max(10).default(1),
	})
	.strict();

const NoteNodeConfigSchema = z
	.object({
		content: z.string().optional(),
		backgroundColor: z.string().optional(),
		textColor: z.string().optional(),
	})
	.strict();

const CropNodeConfigSchema = z
	.object({
		leftPercentage: z.number().min(0).max(100),
		topPercentage: z.number().min(0).max(100),
		widthPercentage: z.number().min(0).max(100),
		heightPercentage: z.number().min(0).max(100),
	})
	.strict();
// Compositor Node
const CompositorLayerSchema = z
	.object({
		id: z.string(),
		inputHandleId: z.string(),
		type: z.enum(["Text", "Image"]),
		name: z.string().optional(),
		x: z.number(),
		y: z.number(),
		width: z.number().optional(),
		height: z.number().optional(),
		rotation: z.number(),
		fontFamily: z.string().optional(),
		fontSize: z.number().optional(),
		fill: z.string().optional(),
		lockAspect: z.boolean(),
		blendMode: z.string(),
		letterSpacing: z.number().optional(),
		lineHeight: z.number().optional(),
		zIndex: z.number().optional(),
		align: z.enum(["left", "center", "right"]).optional(),
		verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),
	})
	.strict();

const CompositorNodeConfigSchema = z
	.object({
		layerUpdates: z.record(
			z.string(), // Input Handle ID
			CompositorLayerSchema,
		),
		width: z.number().optional(),
		height: z.number().optional(),
	})
	.strict();

// Describer Node
const DescriberNodeConfigSchema = z
	.object({
		prompt: z.string(),
		text: z.string(), // Output
	})
	.strict();

// Router Node
const RouterNodeConfigSchema = z
	.object({
		invert: z.boolean().optional(),
	})
	.strict();

const LLM_NODE_MODELS = [
	"google/gemini-3-pro-preview",
	"google/gemini-3-flash",
] as const;

const LLMNodeConfigSchema = z
	.object({
		model: z.enum(LLM_NODE_MODELS),
		temperature: z.number().min(0).max(2).optional().default(0),
	})
	.strict();

const AGENT_NODE_MODELS = [
	"google/gemini-3-pro-preview",
	"google/gemini-3-flash",
] as const;

const AgentNodeConfigSchema = z
	.object({
		model: z.enum(AGENT_NODE_MODELS),
		maxTurns: z.number().int().min(1).optional().default(10),
	})
	.strict();

// Resize Node
const ResizeNodeConfigSchema = z
	.object({
		originalWidth: z.number().int().positive().optional(),
		originalHeight: z.number().int().positive().optional(),
		width: z.number().int().positive().optional(),
		height: z.number().int().positive().optional(),
		maintainAspect: z.boolean().optional(),
	})
	.strict();

const VIDEOGEN_NODE_MODELS = [
	"veo-3.1-generate-preview",
	"veo-3.1-fast-generate-preview",
] as const;

const VideoGenBaseSchema = z.object({
	model: z.enum(VIDEOGEN_NODE_MODELS),
});

const VideoGenNodeConfigSchema = VideoGenBaseSchema;
const VideoGenFirstLastFrameNodeConfigSchema = VideoGenBaseSchema;
const VideoGenExtendNodeConfigSchema = VideoGenBaseSchema;

// Main node schema
const NodeConfigSchema = z.union([
	ImageGenNodeConfigSchema,
	LLMNodeConfigSchema,
	TextNodeConfigSchema,
	FileNodeConfigSchema,
	AgentNodeConfigSchema,
	PreviewNodeConfigSchema,
	MaskNodeConfigSchema,
	PaintNodeConfigSchema,
	BlurNodeConfigSchema,
	CompositorNodeConfigSchema,
	DescriberNodeConfigSchema,
	RouterNodeConfigSchema,
	ResizeNodeConfigSchema,
	NoteNodeConfigSchema,
	ModulateNodeConfigSchema,
	VideoGenNodeConfigSchema,
]);

// Inferred types
type TextNodeConfig = z.infer<typeof TextNodeConfigSchema>;
type AgentNodeConfig = z.infer<typeof AgentNodeConfigSchema>;
type LLMNodeConfig = z.infer<typeof LLMNodeConfigSchema>;
type FileNodeConfig = z.infer<typeof FileNodeConfigSchema>;
type PreviewNodeConfig = z.infer<typeof PreviewNodeConfigSchema>;
type MaskNodeConfig = z.infer<typeof MaskNodeConfigSchema>;
type PaintNodeConfig = z.infer<typeof PaintNodeConfigSchema>;
type BlurNodeConfig = z.infer<typeof BlurNodeConfigSchema>;
type CompositorNodeConfig = z.infer<typeof CompositorNodeConfigSchema>;
type CompositorLayer = z.infer<typeof CompositorLayerSchema>;
type DescriberNodeConfig = z.infer<typeof DescriberNodeConfigSchema>;
type RouterNodeConfig = z.infer<typeof RouterNodeConfigSchema>;
type ResizeNodeConfig = z.infer<typeof ResizeNodeConfigSchema>;
type AllNodeConfig = z.infer<typeof NodeConfigSchema>;
type ImageGenConfig = z.infer<typeof ImageGenNodeConfigSchema>;
type CropNodeConfig = z.infer<typeof CropNodeConfigSchema>;
type NoteNodeConfig = z.infer<typeof NoteNodeConfigSchema>;
type ModulateNodeConfig = z.infer<typeof ModulateNodeConfigSchema>;
type VideoGenNodeConfig = z.infer<typeof VideoGenNodeConfigSchema>;
type VideoGenExtendNodeConfig = z.infer<typeof VideoGenExtendNodeConfigSchema>;
type VideoGenFirstLastFrameNodeConfig = z.infer<
	typeof VideoGenFirstLastFrameNodeConfigSchema
>;

export {
	NodeConfigSchema,
	CropNodeConfigSchema,
	TextNodeConfigSchema,
	FileNodeConfigSchema,
	AgentNodeConfigSchema,
	PreviewNodeConfigSchema,
	MaskNodeConfigSchema,
	PaintNodeConfigSchema,
	BlurNodeConfigSchema,
	CompositorNodeConfigSchema,
	DescriberNodeConfigSchema,
	LLMNodeConfigSchema,
	RouterNodeConfigSchema,
	ResizeNodeConfigSchema,
	NoteNodeConfigSchema,
	CompositorLayerSchema,
	ImageGenNodeConfigSchema,
	ModulateNodeConfigSchema,
	VideoGenNodeConfigSchema,
	type TextNodeConfig,
	type FileNodeConfig,
	type AgentNodeConfig,
	type PreviewNodeConfig,
	type LLMNodeConfig,
	type MaskNodeConfig,
	type PaintNodeConfig,
	type BlurNodeConfig,
	type CompositorLayer,
	type CompositorNodeConfig,
	type DescriberNodeConfig,
	type RouterNodeConfig,
	type ResizeNodeConfig,
	type AllNodeConfig,
	type ImageGenConfig,
	type CropNodeConfig,
	type NoteNodeConfig,
	type ModulateNodeConfig,
	type VideoGenNodeConfig,
	type VideoGenExtendNodeConfig,
	type VideoGenFirstLastFrameNodeConfig,
	LLM_NODE_MODELS,
	IMAGEGEN_NODE_MODELS,
	AGENT_NODE_MODELS,
};
