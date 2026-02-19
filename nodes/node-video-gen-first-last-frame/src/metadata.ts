import { defineMetadata } from "@gatewai/node-sdk";
import {
	VIDEOGEN_ASPECT_RATIOS,
	VIDEOGEN_NODE_MODELS,
	VIDEOGEN_PERSON_GENERATION_OPTIONS,
	VIDEOGEN_RESOLUTIONS,
	VideoGenFirstLastFrameNodeConfigSchema,
} from "./shared/index.js";

export { VideoGenFirstLastFrameNodeConfigSchema };

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
		outputs: [{ dataTypes: ["Video"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		model: "veo-3.1-generate-preview",
		aspectRatio: "16:9",
		resolution: "720p",
		durationSeconds: "8",
		personGeneration: "allow_adult",
	},
});
