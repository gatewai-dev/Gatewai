import { defineMetadata } from "@gatewai/node-sdk";
import { BlurNodeConfigSchema, BlurNodeConfig } from "./shared/index.js";

export const metadata = defineMetadata({
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
	defaultConfig: { size: 5 } as BlurNodeConfig,
});
