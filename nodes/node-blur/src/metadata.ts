import { defineMetadata } from "@gatewai/node-sdk/server";
import { type BlurNodeConfig, BlurNodeConfigSchema } from "./shared/index.js";

export const metadata = defineMetadata({
	type: "Blur",
	displayName: "Blur",
	description: "Apply blur to an image",
	category: "Image",
	configSchema: BlurNodeConfigSchema,
	// Not a terminal node - it won't process automatically after inputs change on browser
	isTerminal: false,
	// Results are stored in the temporary storage, so they are transient
	isTransient: true,
	handles: {
		inputs: [
			{ dataTypes: ["Image"], required: true, label: "Image", order: 0 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: { size: 5 } as BlurNodeConfig,
});
