import { defineMetadata } from "@gatewai/node-sdk";
import { z } from "zod";

const PercentageSchema = z.number().min(0).max(100).default(0);

export const CropNodeConfigSchema = z
	.object({
		leftPercentage: PercentageSchema,
		topPercentage: PercentageSchema,
		widthPercentage: PercentageSchema,
		heightPercentage: PercentageSchema,
	})
	.strict();

export default defineMetadata({
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
