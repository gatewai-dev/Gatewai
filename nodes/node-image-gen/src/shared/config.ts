import { z } from "zod";

export const IMAGEGEN_ASPECT_RATIOS = [
	"1:1",
	"2:3",
	"3:2",
	"3:4",
	"4:3",
	"4:5",
	"5:4",
	"9:16",
	"16:9",
	"21:9",
] as const;

export const IMAGEGEN_IMAGE_SIZES = ["1K", "2K", "4K"] as const;

export const IMAGEGEN_NODE_MODELS = [
	"gemini-3-pro-image-preview",
	"gemini-2.5-flash-image",
] as const;

export const ImageGenNodeConfigSchema = z
	.object({
		model: z.enum(IMAGEGEN_NODE_MODELS),
		aspectRatio: z.enum(IMAGEGEN_ASPECT_RATIOS).default("1:1"),
		imageSize: z.enum(IMAGEGEN_IMAGE_SIZES).default("1K"),
	})
	.strict()
	.refine(
		(data) =>
			!(data.model === "gemini-2.5-flash-image" && data.imageSize !== "1K"),
		{
			message: "Higher resolutions only supported by pro model",
			path: ["imageSize"],
		},
	);

export type ImageGenNodeConfig = z.infer<typeof ImageGenNodeConfigSchema>;

import {
	createOutputItemSchema,
	FileDataSchema,
	MultiOutputGenericSchema,
} from "@gatewai/core/types";

export const ImageGenResultSchema = MultiOutputGenericSchema(
	createOutputItemSchema(z.literal("Image"), FileDataSchema),
);

export type ImageGenResult = z.infer<typeof ImageGenResultSchema>;
