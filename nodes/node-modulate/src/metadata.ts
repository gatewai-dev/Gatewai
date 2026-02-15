import { defineMetadata } from "@gatewai/node-sdk";

export { ModulateNodeConfigSchema } from "./shared/config.js";

import { ModulateNodeConfigSchema } from "./shared/config.js";

export default defineMetadata({
	type: "Modulate",
	displayName: "Modulate",
	description: "Apply Modulate adjustments to an image",
	category: "Image",
	configSchema: ModulateNodeConfigSchema,
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
