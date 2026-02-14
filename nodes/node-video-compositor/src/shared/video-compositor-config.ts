import { BaseLayerSchema, PositionSchema, SizeSchema, RotationSchema, FontOptionsSchema, AspectLockSchema, ZIndexSchema, VideoTimingSchema, AudioOptionsSchema, AnimationSchema, ScaleSchema, OpacitySchema, AlignmentSchema, StrokeSchema, PaddingSchema, DimensionSchema } from "@gatewai/node-sdk";
import z from "zod";

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
        type: z.enum(["Text", "Image", "Video", "Audio"]),
        backgroundColor: z.string().optional(),
        borderColor: z.string().optional(),
        borderWidth: z.number().min(0).optional(),
        borderRadius: z.number().min(0).optional(),
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