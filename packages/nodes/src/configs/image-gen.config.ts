import { z } from "zod";
import { DimensionSchema } from "../common/schemas.js";

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
		prompt: z.string().optional(),
		negativePrompt: z.string().optional(),
		imageSize: z.enum(IMAGEGEN_IMAGE_SIZES).default("1K"),
		width: DimensionSchema,
		height: DimensionSchema,
		aspectRatio: z.enum(IMAGEGEN_ASPECT_RATIOS).default("1:1"),
		batchSize: z.number().int().min(1).max(4).default(1),
		model: z.enum(IMAGEGEN_NODE_MODELS).default("gemini-3-pro-image-preview"),
		guidanceScale: z.number().min(0).max(100).optional(),
		personGeneration: z
			.enum(["allow_adult", "block_adult"])
			.default("block_adult"),
		safetySetting: z.enum(["block_none", "block_most"]).default("block_most"),
	})
	.strict();

export type ImageGenNodeConfig = z.infer<typeof ImageGenNodeConfigSchema>;
