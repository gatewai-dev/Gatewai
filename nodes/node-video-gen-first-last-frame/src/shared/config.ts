import { z } from "zod";

export const VIDEOGEN_NODE_MODELS = [
	"veo-3.1-generate-preview",
	"veo-3.1-fast-generate-preview",
] as const;

export const VIDEOGEN_ASPECT_RATIOS = ["16:9", "9:16"] as const;
export const VIDEOGEN_RESOLUTIONS = ["720p", "1080p"] as const;
export const VIDEOGEN_PERSON_GENERATION_OPTIONS = [
	"allow_all",
	"allow_adult",
	"dont_allow",
] as const;

export const VideoGenFirstLastFrameNodeConfigSchema = z
	.object({
		model: z.enum(VIDEOGEN_NODE_MODELS),
		aspectRatio: z.enum(VIDEOGEN_ASPECT_RATIOS).default("16:9"),
		resolution: z.enum(VIDEOGEN_RESOLUTIONS).default("720p"),
		personGeneration: z
			.enum(VIDEOGEN_PERSON_GENERATION_OPTIONS)
			.default("allow_adult"),
		durationSeconds: z.literal("8"),
	})
	.strict();

export type VideoGenFirstLastFrameNodeConfig = z.infer<
	typeof VideoGenFirstLastFrameNodeConfigSchema
>;

import {
	createOutputItemSchema,
	FileDataSchema,
	MultiOutputGenericSchema,
} from "@gatewai/core/types";

export const VideoGenFirstLastFrameResultSchema = MultiOutputGenericSchema(
	createOutputItemSchema(z.literal("Video"), FileDataSchema),
);

export type VideoGenFirstLastFrameResult = z.infer<
	typeof VideoGenFirstLastFrameResultSchema
>;
