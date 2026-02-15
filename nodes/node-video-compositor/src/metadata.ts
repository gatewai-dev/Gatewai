import { defineMetadata, type NodeTemplateManifest } from "@gatewai/node-sdk";
import { VideoCompositorNodeConfigSchema } from "./shared/index.js";

export { VideoCompositorNodeConfigSchema };

export const manifest: NodeTemplateManifest = {
	type: "video-compositor",
	category: "Video",
	label: "Video Compositor",
	handles: [],
	config: {},
};
