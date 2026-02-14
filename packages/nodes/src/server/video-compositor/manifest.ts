import { defineNode } from "@gatewai/node-sdk";
import { VideoCompositorNodeConfigSchema } from "../../configs/video-compositor.config.js";
import VideoCompositorProcessor from "./processor.js";

export default defineNode({
	type: "VideoCompositor",
	displayName: "Video Compositor",
	description: "Compose videos",
	category: "Video",
	configSchema: VideoCompositorNodeConfigSchema,
	isTerminal: false,
	isTransient: true,
	variableInputs: {
		enabled: true,
		dataTypes: ["Image", "Audio", "Video", "Text"],
	},
	handles: {
		inputs: [],
		outputs: [],
	},
	defaultConfig: {
		width: 1080,
		height: 1080,
		FPS: 24,
		layerUpdates: {},
	},
	backendProcessor: VideoCompositorProcessor,
});
