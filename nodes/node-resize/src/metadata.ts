import { defineMetadata } from "@gatewai/node-sdk";
import { ResizeNodeConfigSchema } from "./shared/index.js";

export { ResizeNodeConfigSchema };

export default defineMetadata({
	type: "Resize",
	displayName: "Resize",
	description: "Resize an image",
	category: "Image",
	configSchema: ResizeNodeConfigSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [
			{ dataTypes: ["Image"], required: true, label: "Image", order: 0 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		width: 1024,
		height: 1024,
		maintainAspect: true,
	},
});
