import { defineMetadata } from "@gatewai/node-sdk";
import {
	VIDEOGEN_ASPECT_RATIOS,
	VIDEOGEN_DURATIONS,
	VIDEOGEN_NODE_MODELS,
	VIDEOGEN_PERSON_GENERATION_OPTIONS,
	VIDEOGEN_RESOLUTIONS,
	VideoGenNodeConfigSchema,
} from "./shared/index.js";

export { VideoGenNodeConfigSchema };

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
