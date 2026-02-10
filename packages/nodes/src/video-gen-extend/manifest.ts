import { defineNode } from "@gatewai/node-sdk";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "VideoGenExtend",
	displayName: "Video Extend",
	description: "Extend a video with Veo",
	category: "AI",
	subcategory: "Video",
	version: "1.0.0",
	isTerminal: true,
	isTransient: false,
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{
				dataTypes: ["Text"],
				required: false,
				label: "Negative Prompt",
				order: 1,
			},
			{
				dataTypes: ["Video"],
				required: true,
				label: "Video to extend",
				order: 2,
			},
		],
		outputs: [{ dataTypes: ["Video"], label: "Video", order: 0 }],
	},
	defaultConfig: { model: "veo-3", durationSeconds: "8", aspectRatio: "16:9" },
	backendProcessor,
});
