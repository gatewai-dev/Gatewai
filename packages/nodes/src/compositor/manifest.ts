import { defineNode } from "@gatewai/node-sdk";

export default defineNode({
	type: "Compositor",
	displayName: "Image Compositor",
	description: "Compose an image using images and texts",
	category: "Image",
	isTerminal: false,
	isTransient: true,
	variableInputs: { enabled: true, dataTypes: ["Image", "Text"] },
	handles: {
		inputs: [{ dataTypes: ["Image"], label: "Image", order: 0 }],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: { width: 1024, height: 1024, layerUpdates: {} },
});
