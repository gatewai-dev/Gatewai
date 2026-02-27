import { VideoFilterSchema, VirtualMediaDataSchema } from "@gatewai/core/types";
import {
	AlignmentSchema,
	AnimationSchema,
	AspectLockSchema,
	AudioOptionsSchema,
	BaseLayerSchema,
	DimensionSchema,
	FontOptionsSchema,
	OpacitySchema,
	PaddingSchema,
	PositionSchema,
	RotationSchema,
	ScaleSchema,
	SizeSchema,
	StrokeSchema,
	VideoTimingSchema,
	ZIndexSchema,
} from "@gatewai/node-sdk";
import { z } from "zod";

export const VariableInputDataTypes = [
	"Text",
	"Image",
	"Video",
	"Audio",
	"Lottie",
	"Caption",
	"SVG",
] as const;
// Video Compositor Layer (extends base with video-specific fields)
export const VideoCompositorLayerSchema = BaseLayerSchema.merge(PositionSchema)
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
	.merge(AlignmentSchema)
	.merge(StrokeSchema)
	.merge(PaddingSchema)
	.extend({
		type: z.enum(VariableInputDataTypes),
		backgroundColor: z.string().optional(),
		borderColor: z.string().optional(),
		borderWidth: z.number().min(0).optional(),
		borderRadius: z.number().min(0).optional(),

		virtualMedia: VirtualMediaDataSchema.optional(),
		trimStart: z.number().min(0).optional(),
		trimEnd: z.number().min(0).optional(),
		speed: z.number().min(0.25).max(4.0).optional(),
		filters: VideoFilterSchema.optional(),
		autoDimensions: z.boolean().optional(),
		transition: z
			.object({
				type: z.enum([
					"crossfade",
					"wipe-left",
					"wipe-right",
					"slide-up",
					"slide-down",
				]),
				durationFrames: z.number().min(1),
			})
			.optional(),
		lottieLoop: z.boolean().optional(),
		lottieFrameRate: z.number().optional(),
		lottieDurationMs: z.number().optional(),
	})
	.strict();

export const VideoCompositorNodeConfigSchema = z
	.object({
		layerUpdates: z.record(
			z.string().describe("The ID of input handle"),
			VideoCompositorLayerSchema,
		),
		width: DimensionSchema,
		height: DimensionSchema,
		FPS: z.number().optional(),
	})
	.strict();

export type VideoCompositorNodeConfig = z.infer<
	typeof VideoCompositorNodeConfigSchema
>;
export type VideoCompositorLayer = z.infer<typeof VideoCompositorLayerSchema>;

import {
	createOutputItemSchema,
	SingleOutputGenericSchema,
} from "@gatewai/core/types";

export const VideoCompositorResultSchema = SingleOutputGenericSchema(
	createOutputItemSchema(z.literal("Video"), VirtualMediaDataSchema),
);

export type VideoCompositorResult = z.infer<typeof VideoCompositorResultSchema>;
