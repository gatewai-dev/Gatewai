import { defineMetadata } from "@gatewai/node-sdk";
import {
	VideoCompositorNodeConfigSchema,
	VideoCompositorResultSchema,
} from "./shared/index.js";

export { VideoCompositorNodeConfigSchema, VideoCompositorResultSchema };

export const metadata = defineMetadata({
	type: "VideoCompositor",
	displayName: "Video Compositor",
	description: "Compose videos using Text, Image, Audio and Video Inputs.",
	category: "Video",
	subcategory: undefined,
	configSchema: VideoCompositorNodeConfigSchema,
	resultSchema: VideoCompositorResultSchema,
	isTerminal: false,
	isTransient: false,
	variableInputs: {
		enabled: true,
		dataTypes: ["Text", "Image", "Audio", "Video"],
	},
	handles: {
		inputs: [],
		outputs: [{ dataTypes: ["Video"], label: "Result", order: 0 }],
	},
	defaultConfig: VideoCompositorNodeConfigSchema.parse({
		layerUpdates: {},
		width: 1080,
		height: 1080,
		FPS: 24,
	}),
});
