import {
	createOutputItemSchema,
	FileDataSchema,
	SingleOutputGenericSchema,
	VirtualMediaDataSchema,
} from "@gatewai/core/types";
import {
	AudioResultSchema,
	ImageResultSchema,
	TextResultSchema,
	VideoResultSchema,
} from "@gatewai/node-sdk";
import { z } from "zod";

export const CropNodeConfigSchema = z
	.object({
		leftPercentage: z.number().min(0).max(100).default(0),
		topPercentage: z.number().min(0).max(100).default(0),
		widthPercentage: z.number().min(0).max(100).default(100),
		heightPercentage: z.number().min(0).max(100).default(100),
	})
	.strict();

export type CropNodeConfig = z.infer<typeof CropNodeConfigSchema>;

export const CropResultSchema = ImageResultSchema;

export type CropResult = z.infer<typeof CropResultSchema>;

export const VideoCropResultSchema = SingleOutputGenericSchema(
	z.union([
		createOutputItemSchema(z.literal("Video"), VirtualMediaDataSchema),
		createOutputItemSchema(z.literal("Audio"), VirtualMediaDataSchema),
	]),
);

export type VideoCropResult = z.infer<typeof VideoCropResultSchema>;
