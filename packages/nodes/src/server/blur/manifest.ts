import { defineNode } from "@gatewai/node-sdk";
import { BlurNodeConfigSchema } from "../../configs/blur.config.js";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "Blur",
	displayName: "Blur",
	description: "Apply blur to an image",
	category: "Image",
	configSchema: BlurNodeConfigSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [
			{ dataTypes: ["Image"], required: true, label: "Image", order: 0 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: { size: 0 },
	backendProcessor,
});
