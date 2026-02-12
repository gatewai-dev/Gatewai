import { defineNode } from "@gatewai/node-sdk";
import { CropNodeConfigSchema } from "../../configs/crop.config.js";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "Crop",
	displayName: "Crop",
	description: "Crop an image",
	category: "Image",
	configSchema: CropNodeConfigSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [
			{ dataTypes: ["Image"], required: true, label: "Image", order: 0 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		leftPercentage: 0,
		topPercentage: 0,
		widthPercentage: 100,
		heightPercentage: 100,
	},
	backendProcessor,
});
