import { defineMetadata } from "@gatewai/node-sdk";
import {
	CropNodeConfigSchema,
	CropResultSchema,
	VideoCropResultSchema,
} from "./shared/index.js";

export { CropNodeConfigSchema, CropResultSchema, VideoCropResultSchema };

export const metadata = defineMetadata({
	type: "Crop",
	displayName: "Crop",
	description: "Crop Video, Image or SVG",
	category: "Media",
	configSchema: CropNodeConfigSchema,
	resultSchema: CropResultSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [
			{
				dataTypes: ["Image", "Video", "SVG"],
				required: true,
				label: "Input",
				order: 0,
			},
		],
		outputs: [{ dataTypes: ["Image", "Video"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		leftPercentage: 0,
		topPercentage: 0,
		widthPercentage: 100,
		heightPercentage: 100,
	},
});
