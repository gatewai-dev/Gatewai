import { defineMetadata } from "@gatewai/node-sdk";
import { CropNodeConfigSchema } from "./shared/index.js";

export { CropNodeConfigSchema };

export const metadata = defineMetadata({
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
});
