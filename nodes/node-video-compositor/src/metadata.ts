import { defineMetadata } from "@gatewai/node-sdk";
import { VideoCompositorNodeConfigSchema } from "./shared/index.js";

export { VideoCompositorNodeConfigSchema };

export const metadata = defineMetadata({
	type: "VideoCompositor",
	displayName: "Video Compositor",
	description: "Compose videos using Text, Image, Audio and Video Inputs.",
	category: "Video",
	subcategory: undefined,
	configSchema: VideoCompositorNodeConfigSchema,
	isTerminal: false,
	isTransient: false,
	variableInputs: {
		enabled: true,
		dataTypes: ["Text", "Image", "Audio", "Video"],
	},
	handles: {
		inputs: [],
		outputs: [],
	},
	defaultConfig: {},
});
