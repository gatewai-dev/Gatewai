import { defineNode } from "@gatewai/node-sdk";
import { ModulateNodeConfigSchema } from "../../configs/modulate.config.js";
import backendProcessor from "./processor.js";

export default defineNode({
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
	backendProcessor,
});
