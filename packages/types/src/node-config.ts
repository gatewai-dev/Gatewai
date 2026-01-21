import { z } from "zod";

// Shared Enums and Constants
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

const LLM_NODE_MODELS = [
	"gemini-3-pro-preview",
	"gemini-3-flash-preview",
] as const;

const AGENT_NODE_MODELS = [
	"gemini-3-pro-preview",
	"gemini-3-flash-preview",
] as const;

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

const STT_NODE_MODELS = [
	"gemini-2.5-flash",
	"gemini-3-flash-preview",
	"gemini-3-pro-preview",
] as const;

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

const COMPOSITE_OPERATIONS = [
	// Basic Compositing
	"source-over",
	"source-in",
	"source-out",
	"source-atop",
	"destination-over",
	"destination-in",
	"destination-out",
	"destination-atop",
	"lighter",
	"copy",
	"xor",

	// Blending Modes
	"multiply",
	"screen",
	"overlay",
	"darken",
	"lighten",
	"color-dodge",
	"color-burn",
	"hard-light",
	"soft-light",
	"difference",
	"exclusion",
	"hue",
	"saturation",
	"color",
	"luminosity",
] as const;

export const GlobalCompositeOperation = z.enum(COMPOSITE_OPERATIONS);

// Extract the TypeScript type from the schema
export type GlobalCompositeOperationType = z.infer<
	typeof GlobalCompositeOperation
>;

// Shared Sub-Schemas
const ColorSchema = z.string().optional();

const PercentageSchema = z.number().min(0).max(100);

const DimensionSchema = z.number().int().positive().optional();

const FontOptionsSchema = z.object({
	fontFamily: z.string().optional(),
	fontSize: z.number().optional(),
	fontStyle: z.string().optional(),
	textDecoration: z.string().optional(),
	letterSpacing: z.number().optional(),
	lineHeight: z.number().optional(),
	fontWeight: z.string().optional(),
});

const AlignmentSchema = z.object({
	align: z.enum(["left", "center", "right"]).optional(),
	verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),
});

const PositionSchema = z.object({
	x: z.number(),
	y: z.number(),
});

const SizeSchema = z.object({
	width: DimensionSchema,
	height: DimensionSchema,
});

const RotationSchema = z.object({
	rotation: z.number(),
});

const AspectLockSchema = z.object({
	lockAspect: z.boolean(),
});

const OpacitySchema = z.object({
	opacity: PercentageSchema.optional().default(100),
});

const ZIndexSchema = z.object({
	zIndex: z.number().optional(),
});

const VideoTimingSchema = z.object({
	startFrame: z.number().optional(),
	durationInFrames: z.number().optional(),
	duration: z.number().optional(),
});

const AudioOptionsSchema = z.object({
	src: z.string().optional(),
	volume: z.number().optional(),
});

const AnimationSchema = z.object({
	animations: z
		.array(
			z.object({
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
			}),
		)
		.optional(),
});

const ScaleSchema = z.object({
	scale: z.number().optional(),
});

// Base Layer Schema (shared between Compositor and VideoCompositor layers)
const BaseLayerSchema = z.object({
	id: z.string(),
	inputHandleId: z.string(),
	name: z.string().optional(),
	fill: ColorSchema,
	blendMode: GlobalCompositeOperation.optional(),
});

// Compositor Layer (extends base)
const CompositorLayerSchema = BaseLayerSchema.merge(PositionSchema)
	.merge(SizeSchema)
	.merge(RotationSchema)
	.merge(FontOptionsSchema)
	.merge(AlignmentSchema)
	.merge(AspectLockSchema)
	.merge(ZIndexSchema)
	.merge(OpacitySchema)
	.extend({
		type: z.enum(["Text", "Image"]),
		align: z.string().optional(),
		verticalAlign: z.string().optional(),
	})
	.strict();

// Video Compositor Layer (extends base with video-specific fields)
const VideoCompositorLayerSchema = BaseLayerSchema.merge(PositionSchema)
	.merge(SizeSchema)
	.merge(RotationSchema)
	.merge(FontOptionsSchema)
	.merge(AspectLockSchema)
	.merge(ZIndexSchema)
	.merge(VideoTimingSchema)
	.merge(AudioOptionsSchema)
	.merge(AnimationSchema)
	.merge(ScaleSchema)
	.merge(OpacitySchema)
	.extend({
		type: z.enum(["Text", "Image", "Video", "Audio"]),
	})
	.strict();

// Base VideoGen Schema (shared across video gen variants to avoid repetition)
const VideoGenBaseSchema = z.object({
	model: z.enum(VIDEOGEN_NODE_MODELS),
	aspectRatio: z.enum(VIDEOGEN_ASPECT_RATIOS).default("16:9"),
	resolution: z.enum(VIDEOGEN_RESOLUTIONS).default("720p"),
	personGeneration: z
		.enum(VIDEOGEN_PERSON_GENERATION_OPTIONS)
		.default("allow_adult"),
});

// Speaker Voice Config (for TTS)
const SpeakerVoiceConfigSchema = z
	.object({
		speaker: z
			.string()
			.describe("The name of the speaker as it appears in the text prompt")
			.optional(),
		voiceName: z.enum(TTS_VOICE_NAMES),
	})
	.strict();

// Node-Specific Schemas (grouped by category for easier navigation/addition)

// Text-Related Nodes
const TextNodeConfigSchema = z
	.object({
		content: z.string().optional(),
	})
	.strict();

const TextMergerNodeConfigSchema = z
	.object({
		join: z.string().optional().default("\n"),
	})
	.strict();

const NoteNodeConfigSchema = z
	.object({
		content: z.string().optional(),
		backgroundColor: ColorSchema,
		textColor: ColorSchema,
	})
	.strict();

// File/Preview Nodes
const FileNodeConfigSchema = z.object({}).strict();

const PreviewNodeConfigSchema = z.object({}).strict();

// Image-Related Nodes
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

const PaintNodeConfigSchema = z
	.object({
		width: z.number().int(),
		height: z.number().int(),
		maintainAspect: z.boolean(),
		backgroundColor: ColorSchema,
		paintData: z.string().optional(),
	})
	.strict();

const BlurNodeConfigSchema = z
	.object({
		size: z.number().min(0).max(100).optional(),
	})
	.strict();

const ModulateNodeConfigSchema = z
	.object({
		hue: z.number().min(0).max(360).default(0),
		saturation: z.number().min(0).max(10).default(1),
		lightness: z.number().min(0).max(10).default(1),
		brightness: z.number().min(0).max(10).default(1),
	})
	.strict();

const CropNodeConfigSchema = z
	.object({
		leftPercentage: PercentageSchema,
		topPercentage: PercentageSchema,
		widthPercentage: PercentageSchema,
		heightPercentage: PercentageSchema,
	})
	.strict();

const ResizeNodeConfigSchema = z
	.object({
		originalWidth: DimensionSchema,
		originalHeight: DimensionSchema,
		width: DimensionSchema,
		height: DimensionSchema,
		maintainAspect: z.boolean().optional(),
	})
	.strict();

const MaskNodeConfigSchema = z.object({}).strict();

// Compositor Nodes
const CompositorNodeConfigSchema = z
	.object({
		layerUpdates: z.record(z.string(), CompositorLayerSchema),
		width: DimensionSchema,
		height: DimensionSchema,
	})
	.strict();

const VideoCompositorNodeConfigSchema = z
	.object({
		layerUpdates: z.record(z.string(), VideoCompositorLayerSchema),
		width: DimensionSchema,
		height: DimensionSchema,
		FPS: z.number().optional(),
	})
	.strict();

// AI/LLM Nodes
const LLMNodeConfigSchema = z
	.object({
		model: z.enum(LLM_NODE_MODELS),
		temperature: z.number().min(0).max(2).optional().default(0),
	})
	.strict();

// Video-Related Nodes
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

const VideoGenExtendNodeConfigSchema = VideoGenBaseSchema.extend({
	durationSeconds: z.literal("7"),
	resolution: z.literal("720p"),
}).strict();

const VideoGenFirstLastFrameNodeConfigSchema = VideoGenBaseSchema.extend({
	durationSeconds: z.literal("8"),
}).strict();

// Audio/Speech Nodes
const SpeechToTextNodeConfigSchema = z
	.object({
		model: z.enum(STT_NODE_MODELS).default("gemini-2.5-flash"),
	})
	.strict();

const TextToSpeechNodeConfigSchema = z
	.object({
		model: z.enum(TTS_NODE_MODELS).default("gemini-2.5-flash-preview-tts"),
		languageCode: z.enum(TTS_LANGUAGES).optional(),
		voiceName: z.string().optional(),
		// Make the base schema's speaker field optional so it doesn't
		// throw errors before your custom logic runs
		speakerConfig: z.array(SpeakerVoiceConfigSchema).max(2).optional(),
	})
	.strict()
	.superRefine((data, ctx) => {
		const config = data.speakerConfig ?? [];

		// If there is only 1 or 0 configs, we don't need to enforce names
		// (unless your business logic says otherwise).
		if (config.length !== 2) return;

		const [c1, c2] = config;
		const s1 = c1.speaker?.trim() ?? "";
		const s2 = c2.speaker?.trim() ?? "";

		// 1. Check if first speaker is empty
		if (s1 === "") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Speaker name is required for multi-speaker setups",
				path: ["speakerConfig", 0, "speaker"],
			});
		}

		// 2. Check if second speaker is empty
		if (s2 === "") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Speaker name is required for multi-speaker setups",
				path: ["speakerConfig", 1, "speaker"],
			});
		}

		// 3. Check for uniqueness
		if (s1 !== "" && s2 !== "" && s1 === s2) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Speaker names must be unique",
				path: ["speakerConfig", 1, "speaker"],
			});
		}
	});

// Consolidated Union Schema
const allNodeConfigSchemas = [
	TextNodeConfigSchema,
	TextMergerNodeConfigSchema,
	FileNodeConfigSchema,
	ImageGenNodeConfigSchema,
	PreviewNodeConfigSchema,
	MaskNodeConfigSchema,
	PaintNodeConfigSchema,
	BlurNodeConfigSchema,
	ModulateNodeConfigSchema,
	NoteNodeConfigSchema,
	CropNodeConfigSchema,
	CompositorNodeConfigSchema,
	LLMNodeConfigSchema,
	ResizeNodeConfigSchema,
	VideoGenNodeConfigSchema,
	VideoGenExtendNodeConfigSchema,
	VideoGenFirstLastFrameNodeConfigSchema,
	SpeechToTextNodeConfigSchema,
	TextToSpeechNodeConfigSchema,
	VideoCompositorNodeConfigSchema,
] as const;

export const NodeConfigSchema = z.union(allNodeConfigSchemas);

export type TextNodeConfig = z.infer<typeof TextNodeConfigSchema>;
export type TextMergerNodeConfig = z.infer<typeof TextMergerNodeConfigSchema>;
export type FileNodeConfig = z.infer<typeof FileNodeConfigSchema>;
export type ImageGenConfig = z.infer<typeof ImageGenNodeConfigSchema>;
export type PreviewNodeConfig = z.infer<typeof PreviewNodeConfigSchema>;
export type MaskNodeConfig = z.infer<typeof MaskNodeConfigSchema>;
export type PaintNodeConfig = z.infer<typeof PaintNodeConfigSchema>;
export type BlurNodeConfig = z.infer<typeof BlurNodeConfigSchema>;
export type ModulateNodeConfig = z.infer<typeof ModulateNodeConfigSchema>;
export type NoteNodeConfig = z.infer<typeof NoteNodeConfigSchema>;
export type CropNodeConfig = z.infer<typeof CropNodeConfigSchema>;
export type CompositorNodeConfig = z.infer<typeof CompositorNodeConfigSchema>;
export type CompositorLayer = z.infer<typeof CompositorLayerSchema>;
export type LLMNodeConfig = z.infer<typeof LLMNodeConfigSchema>;
export type ResizeNodeConfig = z.infer<typeof ResizeNodeConfigSchema>;
export type VideoGenNodeConfig = z.infer<typeof VideoGenNodeConfigSchema>;
export type VideoGenExtendNodeConfig = z.infer<
	typeof VideoGenExtendNodeConfigSchema
>;
export type VideoGenFirstLastFrameNodeConfig = z.infer<
	typeof VideoGenFirstLastFrameNodeConfigSchema
>;
export type SpeechToTextNodeConfig = z.infer<
	typeof SpeechToTextNodeConfigSchema
>;
export type TextToSpeechNodeConfig = z.infer<
	typeof TextToSpeechNodeConfigSchema
>;
export type VideoCompositorNodeConfig = z.infer<
	typeof VideoCompositorNodeConfigSchema
>;
export type VideoCompositorLayer = z.infer<typeof VideoCompositorLayerSchema>;

// Union Type for All Node Configs
export type AllNodeConfig = z.infer<typeof NodeConfigSchema>;

export {
	TextNodeConfigSchema,
	TextMergerNodeConfigSchema,
	FileNodeConfigSchema,
	ImageGenNodeConfigSchema,
	PreviewNodeConfigSchema,
	MaskNodeConfigSchema,
	PaintNodeConfigSchema,
	BlurNodeConfigSchema,
	ModulateNodeConfigSchema,
	NoteNodeConfigSchema,
	CropNodeConfigSchema,
	CompositorNodeConfigSchema,
	LLMNodeConfigSchema,
	ResizeNodeConfigSchema,
	VideoGenNodeConfigSchema,
	VideoGenExtendNodeConfigSchema,
	VideoGenFirstLastFrameNodeConfigSchema,
	SpeechToTextNodeConfigSchema,
	TextToSpeechNodeConfigSchema,
	VideoCompositorNodeConfigSchema,
	IMAGEGEN_ASPECT_RATIOS,
	IMAGEGEN_IMAGE_SIZES,
	IMAGEGEN_NODE_MODELS,
	LLM_NODE_MODELS,
	AGENT_NODE_MODELS,
	VIDEOGEN_NODE_MODELS,
	VIDEOGEN_ASPECT_RATIOS,
	VIDEOGEN_RESOLUTIONS,
	VIDEOGEN_DURATIONS,
	VIDEOGEN_PERSON_GENERATION_OPTIONS,
	STT_NODE_MODELS,
	TTS_NODE_MODELS,
	TTS_VOICE_NAMES,
	COMPOSITE_OPERATIONS,
	TTS_LANGUAGES,
};
