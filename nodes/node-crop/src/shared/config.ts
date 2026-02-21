import {
	createOutputItemSchema,
	FileDataSchema,
	SingleOutputGenericSchema,
} from "@gatewai/core/types";
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

export const CropResultSchema = SingleOutputGenericSchema(
	createOutputItemSchema(z.literal("Image"), FileDataSchema),
);

export type CropResult = z.infer<typeof CropResultSchema>;
