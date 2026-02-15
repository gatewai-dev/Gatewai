import { defineMetadata, type NodeTemplateManifest } from "@gatewai/node-sdk";
import { CompositorNodeConfigSchema } from "./shared/index.js";

export { CompositorNodeConfigSchema };

export const manifest: NodeTemplateManifest = {
	type: "image-compositor",
	category: "Image",
	label: "Image Compositor",
	handles: [],
	config: {},
};
