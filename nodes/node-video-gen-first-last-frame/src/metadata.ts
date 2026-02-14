import { defineMetadata } from "@gatewai/node-sdk";
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

export default defineMetadata({
	type: "VideoGenFirstLastFrame",
	displayName: "First to last frame video",
	description: "Generate videos using first and last frame images",
	category: "AI",
	subcategory: "Video",
	configSchema: VideoGenFirstLastFrameNodeConfigSchema,
	isTerminal: true,
	isTransient: false,
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{
				dataTypes: ["Image"],
				required: true,
				label: "First Frame",
				order: 1,
			},
			{ dataTypes: ["Image"], required: true, label: "Last Frame", order: 2 },
			{
				dataTypes: ["Text"],
				required: false,
				label: "Negative Prompt",
				order: 3,
			},
		],
		outputs: [{ dataTypes: ["Video"], label: "Output", order: 0 }],
	},
	defaultConfig: {
		model: "veo-3.1-generate-preview",
		aspectRatio: "16:9",
		resolution: "720p",
		durationSeconds: "8",
		personGeneration: "allow_adult",
	},
});
