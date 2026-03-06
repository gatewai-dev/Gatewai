import { defineMetadata } from "@gatewai/node-sdk";
import { ResizeNodeConfigSchema, ResizeResultSchema } from "./shared/index.js";

export { ResizeNodeConfigSchema, ResizeResultSchema };

export default defineMetadata({
	type: "Resize",
	displayName: "Resize",
	description: "Resize an image",
	category: "Image",
	configSchema: ResizeNodeConfigSchema,
	resultSchema: ResizeResultSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [
			{ dataTypes: ["Image"], required: true, label: "Image", order: 0 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		width: 1080,
		height: 1080,
		maintainAspect: true,
	},
});
