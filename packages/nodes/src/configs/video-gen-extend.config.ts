import { z } from "zod";
import {
	VIDEOGEN_ASPECT_RATIOS,
	VIDEOGEN_NODE_MODELS,
	VIDEOGEN_PERSON_GENERATION_OPTIONS,
	VIDEOGEN_RESOLUTIONS,
} from "./video-gen.config.js";

// Base VideoGen Schema (shared across video gen variants to avoid repetition)
const VideoGenBaseSchema = z.object({
	model: z.enum(VIDEOGEN_NODE_MODELS),
	aspectRatio: z.enum(VIDEOGEN_ASPECT_RATIOS).default("16:9"),
	resolution: z.enum(VIDEOGEN_RESOLUTIONS).default("720p"),
	personGeneration: z
		.enum(VIDEOGEN_PERSON_GENERATION_OPTIONS)
		.default("allow_adult"),
});

export const VideoGenExtendNodeConfigSchema = VideoGenBaseSchema.extend({
	durationSeconds: z.literal("7"),
	resolution: z.literal("720p"),
}).strict();

export type VideoGenExtendNodeConfig = z.infer<
	typeof VideoGenExtendNodeConfigSchema
>;
