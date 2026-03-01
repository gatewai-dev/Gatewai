import { defineMetadata } from "@gatewai/node-sdk";
import {
	ImageGenNodeConfigSchema,
	ImageGenResultSchema,
} from "./shared/index.js";

export { ImageGenNodeConfigSchema, ImageGenResultSchema };

export default defineMetadata({
	type: "ImageGen",
	displayName: "Generate Image",
	description: "Generate or edit an image using AI",
	category: "AI",
	subcategory: "Image",
	configSchema: ImageGenNodeConfigSchema,
	resultSchema: ImageGenResultSchema,
	isTerminal: true,
	isTransient: false,
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{ dataTypes: ["Image"], label: "Image", order: 1 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		model: "gemini-3-pro-image-preview",
		aspectRatio: "1:1",
		imageSize: "1K",
	},
	pricing: {
		price: 20,
		variantPrices: {
			"gemini-3-pro-image-preview": 30,
			"gemini-2.5-flash-image": 10,
		},
	},
});
