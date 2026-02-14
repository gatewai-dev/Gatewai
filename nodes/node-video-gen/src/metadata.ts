import { defineMetadata } from "@gatewai/node-sdk";
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

export const VideoGenNodeConfigSchema = z
	.object({
		model: z.enum(VIDEOGEN_NODE_MODELS),
		aspectRatio: z.enum(VIDEOGEN_ASPECT_RATIOS).default("16:9"),
		resolution: z.enum(VIDEOGEN_RESOLUTIONS).default("720p"),
		personGeneration: z
			.enum(VIDEOGEN_PERSON_GENERATION_OPTIONS)
			.default("allow_adult"),
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

export default defineMetadata({
	type: "VideoGen",
	displayName: "Generate Video",
	description: "A video generation node.",
	category: "AI",
	subcategory: "Video",
	configSchema: VideoGenNodeConfigSchema,
	isTerminal: true,
	isTransient: false,
	variableInputs: { enabled: true, dataTypes: ["Image"] },
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{
				dataTypes: ["Text"],
				required: false,
				label: "Negative Prompt",
				order: 1,
			},
		],
		outputs: [{ dataTypes: ["Video"], label: "Output", order: 0 }],
	},
	defaultConfig: {
		model: "veo-3.1-generate-preview",
		aspectRatio: "16:9",
		resolution: "720p",
		durationSeconds: "8",
		personGeneration: "allow_all",
	},
});
