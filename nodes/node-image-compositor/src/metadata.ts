import { defineMetadata } from "@gatewai/node-sdk";
import {
	CompositorNodeConfigSchema,
	CompositorResultSchema,
} from "./shared/index.js";

export { CompositorNodeConfigSchema, CompositorResultSchema };

export default defineMetadata({
	type: "ImageCompositor",
	displayName: "Image Compositor",
	description: "Compose images using Text and Image Inputs.",
	category: "Image",
	subcategory: undefined,
	configSchema: CompositorNodeConfigSchema,
	resultSchema: CompositorResultSchema,
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
