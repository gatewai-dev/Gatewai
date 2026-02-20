import {
	AlignmentSchema,
	AspectLockSchema,
	BaseLayerSchema,
	CornerRadiusSchema,
	DimensionSchema,
	FontOptionsSchema,
	OpacitySchema,
	PaddingSchema,
	PositionSchema,
	RotationSchema,
	SizeSchema,
	StrokeSchema,
	ZIndexSchema,
} from "@gatewai/node-sdk";
import { z } from "zod";

// Compositor Layer (extends base)
export const CompositorLayerSchema = BaseLayerSchema.merge(PositionSchema)
	.merge(SizeSchema)
	.merge(RotationSchema)
	.merge(FontOptionsSchema)
	.merge(AlignmentSchema)
	.merge(AspectLockSchema)
	.merge(ZIndexSchema)
	.merge(OpacitySchema)
	.merge(StrokeSchema)
	.merge(CornerRadiusSchema)
	.merge(PaddingSchema)
	.extend({
		type: z.enum(["Text", "Image"]),
		align: z.string().optional(),
		verticalAlign: z.string().optional(),
	})
	.strict();

export const CompositorNodeConfigSchema = z
	.object({
		layerUpdates: z
			.record(
				z.string().describe("The ID of input handle"),
				CompositorLayerSchema,
			)
			.optional()
			.default({}),
		width: DimensionSchema,
		height: DimensionSchema,
	})
	.strict();

export type CompositorNodeConfig = z.infer<typeof CompositorNodeConfigSchema>;
export type CompositorLayer = z.infer<typeof CompositorLayerSchema>;
