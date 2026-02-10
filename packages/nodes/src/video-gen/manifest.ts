import { defineNode } from "@gatewai/node-sdk";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "VideoGen",
	displayName: "Generate Video",
	description: "A video generation node.",
	category: "AI",
	subcategory: "Video",
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
	backendProcessor,
});
