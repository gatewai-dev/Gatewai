import { defineMetadata } from "@gatewai/node-sdk";
import {
	type ModulateNodeConfig,
	ModulateNodeConfigSchema,
	ModulateResultSchema,
} from "./shared/index.js";

export {
	type ModulateNodeConfig,
	ModulateNodeConfigSchema,
	ModulateResultSchema,
};

export const metadata = defineMetadata({
	type: "Modulate",
	displayName: "Modulate",
	description: "Apply Modulate adjustments to an image",
	category: "Image",
	configSchema: ModulateNodeConfigSchema,
	resultSchema: ModulateResultSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [
			{ dataTypes: ["Image"], required: true, label: "Image", order: 0 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: { hue: 0, saturation: 1, lightness: 1, brightness: 1 },
});
