import { z } from "zod";
import { VideoFilterSchema } from "./filter-schema.js";

export const AnimationTypeSchema = z.enum([
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
]);

export type AnimationType = z.infer<typeof AnimationTypeSchema>;

export const VideoAnimationSchema = z.object({
	id: z.string(),
	type: AnimationTypeSchema,
	value: z.number(),
});

export type VideoAnimation = z.infer<typeof VideoAnimationSchema>;

// --- Source: the real underlying file ---
export const VideoSourceSchema = z.object({
	entity: z.any().optional(), // FileAsset from Import/VideoGen
	processData: z
		.object({
			dataUrl: z.string().optional(),
			width: z.number().optional().nullable(),
			height: z.number().optional().nullable(),
			duration: z.number().optional().nullable(), // ms
			fps: z.number().optional().nullable(),
			mimeType: z.string().optional().nullable(),
			tempKey: z.string().optional(),
			text: z.string().optional(),
		})
		.optional(),
});

// --- Video Metadata: current state of the video ---
export const VideoMetadataSchema = z.object({
	width: z.number().optional().nullable(),
	height: z.number().optional().nullable(),
	durationMs: z.number().optional().nullable(),
	fps: z.number().optional().nullable(),
});

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

// --- Operations ---

/** Original source file (leaf node) */
export const SourceOperationSchema = z.object({
	op: z.literal("source"),
	source: VideoSourceSchema,
	sourceMeta: VideoMetadataSchema,
});

/** Text content (leaf node) */
export const TextOperationSchema = z.object({
	op: z.literal("text"),
	text: z.string(),
	// Text doesn't have intrinsic dimensions like video, but we can provide hints/metadata
	metadata: VideoMetadataSchema.optional(),
});

export const CropOperationSchema = z.object({
	op: z.literal("crop"),
	leftPercentage: z.number().min(0).max(100),
	topPercentage: z.number().min(0).max(100),
	widthPercentage: z.number().min(0).max(100),
	heightPercentage: z.number().min(0).max(100),
	metadata: VideoMetadataSchema.optional(),
});

export const CutOperationSchema = z.object({
	op: z.literal("cut"),
	startSec: z.number().min(0),
	endSec: z.number().min(0).nullable(), // null = to end
	metadata: VideoMetadataSchema.optional(),
});

export const SpeedOperationSchema = z.object({
	op: z.literal("speed"),
	rate: z.number().min(0.25).max(4.0),
	metadata: VideoMetadataSchema.optional(),
});

export const FilterOperationSchema = z.object({
	op: z.literal("filter"),
	filters: VideoFilterSchema,
	metadata: VideoMetadataSchema.optional(),
});

export const FlipOperationSchema = z.object({
	op: z.literal("flip"),
	horizontal: z.boolean().default(false),
	vertical: z.boolean().default(false),
	metadata: VideoMetadataSchema.optional(),
});

export const RotateOperationSchema = z.object({
	op: z.literal("rotate"),
	degrees: z.number(),
	metadata: VideoMetadataSchema.optional(),
});

/**
 * Wraps a child with spatial and timing properties.
 * This effectively makes the "layer" part of the operator tree.
 */
export const LayerOperationSchema = z.object({
	op: z.literal("layer"),
	x: z.number().default(0),
	y: z.number().default(0),
	width: z.number().optional(),
	height: z.number().optional(),
	rotation: z.number().default(0),
	scale: z.number().default(1),
	opacity: z.number().default(1),
	startFrame: z.number().default(0),
	durationInFrames: z.number().optional(),
	trimStart: z.number().min(0).optional(),
	trimEnd: z.number().min(0).optional(),
	speed: z.number().min(0.25).max(4.0).optional(),
	zIndex: z.number().optional(),
	metadata: VideoMetadataSchema.optional(),

	// Content & Styling (to prevent loss when wrapping in layer ops)
	text: z.string().optional(),
	fontSize: z.number().optional(),
	fontFamily: z.string().optional(),
	fontStyle: z.string().optional(),
	fontWeight: z.union([z.number(), z.string()]).optional(),
	textDecoration: z.string().optional(),
	fill: z.string().optional(),
	align: z.string().optional(),
	verticalAlign: z.string().optional(),
	letterSpacing: z.number().optional(),
	lineHeight: z.number().optional(),
	padding: z.number().optional(),
	stroke: z.string().optional(),
	strokeWidth: z.number().optional(),
	backgroundColor: z.string().optional(),
	borderColor: z.string().optional(),
	borderWidth: z.number().optional(),
	borderRadius: z.number().optional(),
	autoDimensions: z.boolean().optional(),

	animations: z.array(VideoAnimationSchema).optional(),

	lottieLoop: z.boolean().optional(),
	lottieFrameRate: z.number().optional(),
	lottieDurationMs: z.number().optional(),
});

export const ComposeOperationSchema = z.object({
	op: z.literal("compose"),
	width: z.number(),
	height: z.number(),
	fps: z.number(),
	durationInFrames: z.number(),
	metadata: VideoMetadataSchema.optional(),
});

export const VideoOperationSchema = z.discriminatedUnion("op", [
	SourceOperationSchema,
	TextOperationSchema,
	CropOperationSchema,
	CutOperationSchema,
	SpeedOperationSchema,
	FilterOperationSchema,
	FlipOperationSchema,
	RotateOperationSchema,
	LayerOperationSchema,
	ComposeOperationSchema,
]);

export type VideoOperation = z.infer<typeof VideoOperationSchema>;

// --- VirtualMediaData: THE recursive data type for all Video outputs ---

export type VirtualMediaData = {
	metadata: VideoMetadata;
	operation: VideoOperation;
	children: VirtualMediaData[];
};

export const VirtualMediaDataSchema: z.ZodType<VirtualMediaData> = z.lazy(() =>
	z.object({
		/** Current dimensions/duration of this node's output */
		metadata: VideoMetadataSchema,

		/** The operation applied at this node */
		operation: VideoOperationSchema,

		/** Recursive children (inputs to this operation) */
		children: z.array(VirtualMediaDataSchema).default([]),
	}),
);
