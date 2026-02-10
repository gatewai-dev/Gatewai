import { defineNode } from "@gatewai/node-sdk";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "ImageGen",
	displayName: "Generate Image",
	description: "Generate images using prompt and reference image(s)",
	category: "AI",
	version: "1.0.0",
	isTerminal: true,
	isTransient: false,
	variableInputs: { enabled: true, dataTypes: ["Image"] },
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{
				dataTypes: ["Image"],
				required: false,
				label: "Reference Image",
				order: 1,
			},
		],
		outputs: [{ dataTypes: ["Image"], label: "Image", order: 0 }],
	},
	defaultConfig: { model: "gemini-3-pro-image-preview" },
	backendProcessor,
});
