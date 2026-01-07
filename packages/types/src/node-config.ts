import { z } from "zod";

// Text Node
const TextNodeConfigSchema = z
	.object({
		content: z.string().optional(),
	})
	.strict();

// File Node
const FileNodeConfigSchema = z.object({}).strict();

const IMAGEGEN_ASPECT_RATIOS = [
	"1:1",
	"2:3",
	"3:2",
	"3:4",
	"4:3",
	"4:5",
	"5:4",
	"9:16",
	"16:9",
	"21:9",
] as const;

const IMAGEGEN_IMAGE_SIZES = ["1K", "2K", "4K"] as const;

const IMAGEGEN_NODE_MODELS = [
	"gemini-3-pro-image-preview",
	"gemini-2.5-flash-image",
] as const;

const ImageGenNodeConfigSchema = z
	.object({
		model: z.enum(IMAGEGEN_NODE_MODELS),
		aspectRatio: z.enum(IMAGEGEN_ASPECT_RATIOS).default("1:1"),
		imageSize: z.enum(IMAGEGEN_IMAGE_SIZES).default("1K"),
	})
	.strict()
	.refine(
		(data) =>
			!(data.model === "gemini-2.5-flash-image" && data.imageSize !== "1K"),
		{
			message: "Higher resolutions only supported by pro model",
			path: ["imageSize"],
		},
	);

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
		fontStyle: z.string().optional(),
		textDecoration: z.string().optional(),

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

const LLM_NODE_MODELS = [
	"gemini-3-pro-preview",
	"gemini-3-flash-preview",
] as const;

const LLMNodeConfigSchema = z
	.object({
		model: z.enum(LLM_NODE_MODELS),
		temperature: z.number().min(0).max(2).optional().default(0),
	})
	.strict();

const AGENT_NODE_MODELS = [
	"gemini-3-pro-preview",
	"gemini-3-flash-preview",
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

const VIDEOGEN_ASPECT_RATIOS = ["16:9", "9:16"] as const;

const VIDEOGEN_RESOLUTIONS = ["720p", "1080p"] as const;

const VIDEOGEN_DURATIONS = ["4", "6", "8"] as const;

const VIDEOGEN_PERSON_GENERATION_OPTIONS = [
	"allow_all",
	"allow_adult",
	"dont_allow",
] as const;

const VideoGenBaseSchema = z.object({
	model: z.enum(VIDEOGEN_NODE_MODELS),
	aspectRatio: z.enum(VIDEOGEN_ASPECT_RATIOS).default("16:9"),
	resolution: z.enum(VIDEOGEN_RESOLUTIONS).default("720p"),
	personGeneration: z
		.enum(VIDEOGEN_PERSON_GENERATION_OPTIONS)
		.default("allow_adult"),
});

/**
 * Standard Text-to-Video
 * Includes refinement: 1080p only supports 8s duration.
 */
const VideoGenNodeConfigSchema = VideoGenBaseSchema.extend({
	durationSeconds: z.enum(VIDEOGEN_DURATIONS).default("8"),
})
	.strict()
	.refine(
		(data) => !(data.resolution === "1080p" && data.durationSeconds !== "8"),
		{
			message: "1080p resolution only supports 8s duration",
			path: ["resolution"],
		},
	);

/**
 * Extension Schema
 * Must be 8s, 720p only for extension mode.
 */
const VideoGenExtendNodeConfigSchema = VideoGenBaseSchema.extend({
	durationSeconds: z.literal("7"),
	resolution: z.literal("720p"),
}).strict();

/**
 * Interpolation / First-Last Frame Schema
 * Must be 8s.
 */
const VideoGenFirstLastFrameNodeConfigSchema = VideoGenBaseSchema.extend({
	durationSeconds: z.literal("8"),
}).strict();

// SpeechToText Node (based on Gemini audio understanding)
const STT_NODE_MODELS = [
	"gemini-2.5-flash",
	"gemini-3-flash-preview", // Added pro for variety, assuming support
	"gemini-3-pro-preview", // Added pro for variety, assuming support
] as const;

const SpeechToTextNodeConfigSchema = z
	.object({
		model: z.enum(STT_NODE_MODELS).default("gemini-2.5-flash"),
	})
	.strict();

// TextToSpeech Node (based on Gemini TTS)
const TTS_NODE_MODELS = [
	"gemini-2.5-flash-preview-tts",
	"gemini-2.5-pro-preview-tts",
] as const;

const TTS_VOICE_NAMES = [
	"Zephyr",
	"Puck",
	"Charon",
	"Kore",
	"Fenrir",
	"Leda",
	"Orus",
	"Aoede",
	"Callirrhoe",
	"Autonoe",
	"Enceladus",
	"Iapetus",
	"Umbriel",
	"Algieba",
	"Despina",
	"Erinome",
	"Algenib",
	"Rasalgethi",
	"Laomedeia",
	"Achernar",
	"Alnilam",
	"Schedar",
	"Gacrux",
	"Pulcherrima",
	"Achird",
	"Zubenelgenubi",
	"Vindemiatrix",
	"Sadachbia",
	"Sadaltager",
	"Sulafat",
] as const;

const TTS_LANGUAGES = [
	"ar-EG",
	"en-US",
	"en-IN",
	"fr-FR",
	"de-DE",
	"es-US",
	"hi-IN",
	"id-ID",
	"it-IT",
	"ja-JP",
	"ko-KR",
	"pt-BR",
	"ru-RU",
	"nl-NL",
	"pl-PL",
	"th-TH",
	"tr-TR",
	"vi-VN",
	"ro-RO",
	"uk-UA",
	"bn-BD",
	"mr-IN",
	"ta-IN",
	"te-IN",
] as const;

const SpeakerVoiceConfigSchema = z
	.object({
		speaker: z
			.string()
			.describe("The name of the speaker as it appears in the text prompt"),
		voiceName: z.enum(TTS_VOICE_NAMES),
	})
	.strict();

const TextToSpeechNodeConfigSchema = z
	.object({
		model: z.enum(TTS_NODE_MODELS).default("gemini-2.5-flash-preview-tts"),
		languageCode: z.enum(TTS_LANGUAGES).optional(),
		voiceName: z.string().optional(),
		speakerConfig: z.array(SpeakerVoiceConfigSchema).max(2).optional(),
	})
	.strict();

const VideoEffectsSchema = z.object({
	id: z.string(),
	type: z.enum([
		"fade-in",
		"fade-out",
		"slide-in-left",
		"slide-in-right",
		"slide-in-top",
		"slide-in-bottom",
		"zoom-in",
		"zoom-out",
		"rotate-cw",
		"rotate-ccw",
		"bounce",
		"shake",
	]),
	value: z.number(),
});

const VideoCompositorLayerSchema = z
	.object({
		id: z.string(),
		inputHandleId: z.string(),
		type: z.enum(["Text", "Image", "Video", "Audio"]),
		name: z.string().optional(),
		x: z.number(),
		y: z.number(),
		width: z.number().optional(),
		height: z.number().optional(),
		rotation: z.number(),
		fontFamily: z.string().optional(),
		fontSize: z.number().optional(),
		fontStyle: z.string().optional(),
		textDecoration: z.string().optional(),
		fill: z.string().optional(),
		lockAspect: z.boolean(),
		blendMode: z.string(),
		letterSpacing: z.number().optional(),
		lineHeight: z.number().optional(),
		zIndex: z.number().optional(),
		align: z.enum(["left", "center", "right"]).optional(),
		verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),

		startFrame: z.number().optional(),
		durationInFrames: z.number().optional(),
		duration: z.number().optional(),

		src: z.string().optional(),
		volume: z.number().optional(),
		animations: z.array(VideoEffectsSchema).optional(),
		scale: z.number().optional(),
		opacity: z.number().optional(),
	})
	.strict();

const VideoCompositorNodeConfigSchema = z
	.object({
		layerUpdates: z.record(
			z.string(), // Input Handle ID
			VideoCompositorLayerSchema,
		),
		// Width of the canvas
		width: z.number().optional(),
		// Height of the canvas
		height: z.number().optional(),
		background: z.string().optional(),
		FPS: z.number().optional(),
		isTransparent: z.boolean().optional().default(false),
	})
	.strict();
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
	ResizeNodeConfigSchema,
	NoteNodeConfigSchema,
	ModulateNodeConfigSchema,
	VideoGenNodeConfigSchema,
	SpeechToTextNodeConfigSchema,
	TextToSpeechNodeConfigSchema,
	VideoCompositorNodeConfigSchema,
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
type VideoCompositorNodeConfig = z.infer<
	typeof VideoCompositorNodeConfigSchema
>;
type VideoCompositorLayer = z.infer<typeof VideoCompositorLayerSchema>;
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
type SpeechToTextNodeConfig = z.infer<typeof SpeechToTextNodeConfigSchema>;
type TextToSpeechNodeConfig = z.infer<typeof TextToSpeechNodeConfigSchema>;
type VideoEffectsEnum = z.infer<typeof VideoEffectsSchema>;

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
	CompositorLayerSchema,
	VideoCompositorNodeConfigSchema,
	VideoCompositorLayerSchema,
	LLMNodeConfigSchema,
	ResizeNodeConfigSchema,
	NoteNodeConfigSchema,
	ImageGenNodeConfigSchema,
	ModulateNodeConfigSchema,
	VideoGenNodeConfigSchema,
	VideoGenExtendNodeConfigSchema,
	VideoGenFirstLastFrameNodeConfigSchema,
	SpeechToTextNodeConfigSchema,
	TextToSpeechNodeConfigSchema,
	VideoEffectsSchema,
	type VideoEffectsEnum,
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
	type VideoCompositorLayer,
	type VideoCompositorNodeConfig,
	type ResizeNodeConfig,
	type AllNodeConfig,
	type ImageGenConfig,
	type CropNodeConfig,
	type NoteNodeConfig,
	type ModulateNodeConfig,
	type VideoGenNodeConfig,
	type VideoGenExtendNodeConfig,
	type VideoGenFirstLastFrameNodeConfig,
	type SpeechToTextNodeConfig,
	type TextToSpeechNodeConfig,
	LLM_NODE_MODELS,
	IMAGEGEN_NODE_MODELS,
	IMAGEGEN_ASPECT_RATIOS,
	IMAGEGEN_IMAGE_SIZES,
	AGENT_NODE_MODELS,
	VIDEOGEN_NODE_MODELS,
	VIDEOGEN_ASPECT_RATIOS,
	VIDEOGEN_RESOLUTIONS,
	VIDEOGEN_DURATIONS,
	VIDEOGEN_PERSON_GENERATION_OPTIONS,
	STT_NODE_MODELS,
	TTS_NODE_MODELS,
	TTS_VOICE_NAMES,
	TTS_LANGUAGES,
};
