import { z } from "zod";

// Shared Enums and Constants
export const COMPOSITE_OPERATIONS = [
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

// Shared Sub-Schemas
export const ColorSchema = z.string().optional();

export const PercentageSchema = z.number().min(0).max(100);

export const DimensionSchema = z.number().min(0).optional();

export const FontOptionsSchema = z.object({
	fontFamily: z.string().optional(),
	fontSize: z.number().optional(),
	fontStyle: z.string().optional(),
	textDecoration: z.string().optional(),
	letterSpacing: z.number().optional(),
	lineHeight: z.number().optional(),
	fontWeight: z.string().optional(),
});

export const AlignmentSchema = z.object({
	align: z.enum(["left", "center", "right"]).optional(),
	verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),
});

export const PositionSchema = z.object({
	x: z.number(),
	y: z.number(),
});

export const SizeSchema = z.object({
	width: DimensionSchema,
	height: DimensionSchema,
});

export const RotationSchema = z.object({
	rotation: z.number(),
});

export const AspectLockSchema = z.object({
	lockAspect: z.boolean(),
});

export const OpacitySchema = z.object({
	opacity: PercentageSchema.optional().default(100),
});

export const ZIndexSchema = z.object({
	zIndex: z.number().optional(),
});

export const VideoTimingSchema = z.object({
	startFrame: z.number().optional(),
	durationInFrames: z.number().optional(),
	duration: z.number().optional(),
});

export const AudioOptionsSchema = z.object({
	src: z.string().optional(),
	volume: z.number().min(0).max(100).optional(),
});

export const AnimationSchema = z.object({
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

export const ScaleSchema = z.object({
	scale: z.number().optional(),
});

export const StrokeSchema = z.object({
	stroke: ColorSchema,
	strokeWidth: z.number().min(0).optional(),
});

export const CornerRadiusSchema = z.object({
	cornerRadius: z.number().min(0).optional(),
});

export const PaddingSchema = z.object({
	padding: z.number().min(0).optional(),
});

// Base Layer Schema (shared between Compositor and VideoCompositor layers)
export const BaseLayerSchema = z.object({
	id: z.string(),
	inputHandleId: z.string(),
	name: z.string().optional(),
	fill: ColorSchema,
	blendMode: GlobalCompositeOperation.optional(),
});
