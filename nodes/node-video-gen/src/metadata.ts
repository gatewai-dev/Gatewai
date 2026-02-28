import { defineMetadata } from "@gatewai/node-sdk";
import {
	VideoGenNodeConfigSchema,
	VideoGenResultSchema,
} from "./shared/index.js";

export { VideoGenNodeConfigSchema, VideoGenResultSchema };

export default defineMetadata({
	type: "VideoGen",
	displayName: "Video Generator",
	description: "A video generation node.",
	category: "AI",
	subcategory: "Video",
	configSchema: VideoGenNodeConfigSchema,
	resultSchema: VideoGenResultSchema,
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
		outputs: [{ dataTypes: ["Video"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		model: "veo-3.1-generate-preview",
		aspectRatio: "16:9",
		resolution: "720p",
		durationSeconds: "8",
		personGeneration: "allow_all",
	},
});
