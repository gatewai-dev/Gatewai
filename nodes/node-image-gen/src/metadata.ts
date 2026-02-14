import { defineMetadata } from "@gatewai/node-sdk";
import { z } from "zod";

export const IMAGEGEN_ASPECT_RATIOS = [
	"1:1",
	"9:16",
	"16:9",
	"3:4",
	"4:3",
] as const;
export const IMAGEGEN_IMAGE_SIZES = ["1024", "768", "512"] as const;
export const IMAGEGEN_NODE_MODELS = [
	"imagen-4.0-generate-preview-06-06",
	"gemini-2.0-flash-preview-image-generation",
] as const;

export const ImageGenNodeConfigSchema = z
	.object({
		model: z.enum(IMAGEGEN_NODE_MODELS),
		aspectRatio: z.enum(IMAGEGEN_ASPECT_RATIOS).default("1:1"),
		imageSize: z.enum(IMAGEGEN_IMAGE_SIZES).default("1024"),
		numberOfImages: z.number().min(1).max(4).default(1),
	})
	.strict()
	.refine(
		(data) => {
			if (data.model === "gemini-2.0-flash-preview-image-generation") {
				return data.imageSize === "1024";
			}
			return true;
		},
		{
			message: "Gemini model only supports 1024 image size",
			path: ["imageSize"],
		},
	);

export default defineMetadata({
	type: "ImageGen",
	displayName: "Generate Image",
	description: "Generate an image using AI",
	category: "AI",
	subcategory: "Image",
	configSchema: ImageGenNodeConfigSchema,
	isTerminal: true,
	isTransient: false,
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{ dataTypes: ["Image"], label: "Image", order: 1 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Output", order: 0 }],
	},
	defaultConfig: {
		model: "imagen-4.0-generate-preview-06-06",
		aspectRatio: "1:1",
		imageSize: "1024",
		numberOfImages: 1,
	},
});
