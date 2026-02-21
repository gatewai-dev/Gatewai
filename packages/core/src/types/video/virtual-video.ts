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

// --- Operations ---
export const CropOperationSchema = z.object({
	op: z.literal("crop"),
	x: z.number().min(0),
	y: z.number().min(0),
	width: z.number().min(1),
	height: z.number().min(1),
});

export const CutOperationSchema = z.object({
	op: z.literal("cut"),
	startSec: z.number().min(0),
	endSec: z.number().min(0).nullable(), // null = to end
});

export const SpeedOperationSchema = z.object({
	op: z.literal("speed"),
	rate: z.number().min(0.25).max(4.0),
});

export const FilterOperationSchema = z.object({
	op: z.literal("filter"),
	filters: VideoFilterSchema,
});

export const FlipOperationSchema = z.object({
	op: z.literal("flip"),
	horizontal: z.boolean().default(false),
	vertical: z.boolean().default(false),
});

export const RotateOperationSchema = z.object({
	op: z.literal("rotate"),
	degrees: z.number(),
});

export const ComposeOperationSchema = z.object({
	op: z.literal("compose"),
	layers: z.array(z.any()),
	width: z.number(),
	height: z.number(),
	fps: z.number(),
	durationInFrames: z.number(),
});

export const VideoOperationSchema = z.discriminatedUnion("op", [
	CropOperationSchema,
	CutOperationSchema,
	SpeedOperationSchema,
	FilterOperationSchema,
	FlipOperationSchema,
	RotateOperationSchema,
	ComposeOperationSchema,
]);

export type VideoOperation = z.infer<typeof VideoOperationSchema>;

// --- VirtualVideoData: THE data type for all Video outputs ---
export const VirtualVideoDataSchema = z.object({
	/** Original source file */
	source: VideoSourceSchema,

	/** Source dimensions/duration before any operations */
	sourceMeta: z.object({
		width: z.number().optional(),
		height: z.number().optional(),
		durationMs: z.number().optional(),
		fps: z.number().optional(),
	}),

	/** Ordered operation stack (each node appends to this) */
	operations: z.array(VideoOperationSchema).default([]),
});

export type VirtualVideoData = z.infer<typeof VirtualVideoDataSchema>;
