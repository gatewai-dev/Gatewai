import { defineMetadata } from "@gatewai/node-sdk";
import { CompositorNodeConfigSchema } from "./shared/index.js";

export { CompositorNodeConfigSchema };

export const manifest = defineMetadata({
	type: "ImageCompositor",
	displayName: "Image Compositor",
	description: "Compose images using Text and Image Inputs.",
	category: "Image",
	subcategory: undefined,
	configSchema: CompositorNodeConfigSchema,
	isTerminal: false,
	isTransient: false,
	variableInputs: {
		enabled: true,
		dataTypes: ["Text", "Image"],
	},
	handles: {
		inputs: [],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		layerUpdates: {},
		width: 1080,
		height: 1080,
	},
});
