import { z } from "zod";
import { VideoFilterSchema } from "./filter-schema.js";
import { TransitionSchema } from "./transition-schema.js";
import { VirtualVideoDataSchema } from "./virtual-video.js";

export const ExtendedLayerSchema = z
	.object({
		id: z.string(),
		name: z.string().optional(),
		type: z.enum(["Video", "Image", "Audio", "Text"]),

		// VirtualVideoData from upstream
		virtualVideo: VirtualVideoDataSchema.optional(),

		// Shared spatial properties (re-used from compositor logic)
		x: z.number(),
		y: z.number(),
		width: z.number(),
		height: z.number(),
		rotation: z.number().default(0),
		opacity: z.number().min(0).max(1).default(1),
		scale: z.number().default(1),

		// Per-layer editing (applied on top of upstream ops)
		trimStart: z.number().min(0).optional(),
		trimEnd: z.number().min(0).optional(),
		speed: z.number().min(0.25).max(4.0).optional(),
		filters: VideoFilterSchema.optional(),

		// Transitions
		transitionIn: TransitionSchema.optional(),
		transitionOut: TransitionSchema.optional(),

		// Timing in the composition
		startFrame: z.number().default(0),
		durationInFrames: z.number(),
		maxDurationInFrames: z.number().optional(),

		// Content (resolved before render)
		src: z.string().optional(),
		text: z.string().optional(),
		volume: z.number().default(1),

		// Text styling
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
		lockAspect: z.boolean().optional(),

		// Border / bg
		backgroundColor: z.string().optional(),
		borderColor: z.string().optional(),
		borderWidth: z.number().optional(),
		borderRadius: z.number().optional(),

		// Z-Index
		zIndex: z.number().optional(),

		// Animations
		animations: z.array(z.any()).optional(),

		// Handle info for mapping
		inputHandleId: z.string().optional(),

		// Internal
		isPlaceholder: z.boolean().optional(),
	})
	.strict();

export type ExtendedLayer = z.infer<typeof ExtendedLayerSchema>;
