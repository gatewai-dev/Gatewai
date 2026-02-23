import { z } from "zod";
import { VideoFilterSchema } from "./filter-schema.js";

// --- Source: the real underlying file ---
export const VideoSourceSchema = z.object({
	entity: z.any().optional(), // FileAsset from Import/VideoGen
	processData: z
		.object({
			dataUrl: z.string(),
			width: z.number().optional(),
			height: z.number().optional(),
			duration: z.number().optional(), // ms
			fps: z.number().optional(),
			mimeType: z.string().optional(),
			tempKey: z.string().optional(),
		})
		.optional(),
});

// --- Video Metadata: current state of the video ---
export const VideoMetadataSchema = z.object({
	width: z.number().optional(),
	height: z.number().optional(),
	durationMs: z.number().optional(),
	fps: z.number().optional(),
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
	zIndex: z.number().optional(),
	metadata: VideoMetadataSchema.optional(),
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

// --- VirtualVideoData: THE recursive data type for all Video outputs ---

export type VirtualVideoData = {
	metadata: VideoMetadata;
	operation: VideoOperation;
	children: VirtualVideoData[];
};

export const VirtualVideoDataSchema: z.ZodType<VirtualVideoData> = z.lazy(() =>
	z.object({
		/** Current dimensions/duration of this node's output */
		metadata: VideoMetadataSchema,

		/** The operation applied at this node */
		operation: VideoOperationSchema,

		/** Recursive children (inputs to this operation) */
		children: z.array(VirtualVideoDataSchema).default([]),
	}),
);
