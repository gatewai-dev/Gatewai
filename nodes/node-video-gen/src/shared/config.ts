import { z } from "zod";

export const VIDEOGEN_NODE_MODELS = [
	"veo-3.1-generate-preview",
	"veo-3.1-fast-generate-preview",
] as const;

export const VIDEOGEN_ASPECT_RATIOS = ["16:9", "9:16"] as const;
export const VIDEOGEN_RESOLUTIONS = ["720p", "1080p"] as const;
export const VIDEOGEN_DURATIONS = ["4", "6", "8"] as const;
export const VIDEOGEN_PERSON_GENERATION_OPTIONS = [
	"allow_all",
	"allow_adult",
	"dont_allow",
] as const;

export const VideoGenBaseSchema = z.object({
	model: z.enum(VIDEOGEN_NODE_MODELS),
	aspectRatio: z.enum(VIDEOGEN_ASPECT_RATIOS).default("16:9"),
	resolution: z.enum(VIDEOGEN_RESOLUTIONS).default("720p"),
	personGeneration: z
		.enum(VIDEOGEN_PERSON_GENERATION_OPTIONS)
		.default("allow_adult"),
});

export const VideoGenNodeConfigSchema = VideoGenBaseSchema.extend({
	durationSeconds: z.enum(VIDEOGEN_DURATIONS).default("8"),
})
	.strict()
	.refine(
		(data) => !(data.resolution === "1080p" && data.durationSeconds !== "8"),
		{
			message: "1080p resolution only supports 8s duration",
			path: ["resolution"],
		},
	);

export type VideoGenNodeConfig = z.infer<typeof VideoGenNodeConfigSchema>;

import {
	createOutputItemSchema,
	MultiOutputGenericSchema,
	VirtualMediaDataSchema,
} from "@gatewai/core/types";

export const VideoGenResultSchema = MultiOutputGenericSchema(
	createOutputItemSchema(z.literal("Video"), VirtualMediaDataSchema),
);

export type VideoGenResult = z.infer<typeof VideoGenResultSchema>;
