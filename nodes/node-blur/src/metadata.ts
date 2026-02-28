import { defineMetadata } from "@gatewai/node-sdk/server";
import {
	type BlurNodeConfig,
	BlurNodeConfigSchema,
	BlurResultSchema,
} from "./shared/index.js";

export { type BlurNodeConfig, BlurNodeConfigSchema, BlurResultSchema };

export const metadata = defineMetadata({
	type: "Blur",
	displayName: "Blur",
	description: "Apply blur to an image",
	category: "Image",
	configSchema: BlurNodeConfigSchema,
	resultSchema: BlurResultSchema,
	// Not a terminal node - it won't process automatically after inputs change on browser
	isTerminal: false,
	// Results are stored in the temporary storage, so they are transient
	isTransient: true,
	handles: {
		inputs: [
			{ dataTypes: ["Image", "SVG"], required: true, label: "Input", order: 0 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: { size: 5 } as BlurNodeConfig,
});
