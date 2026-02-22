import {
	createOutputItemSchema,
	SingleOutputGenericSchema,
	VirtualVideoDataSchema,
} from "@gatewai/core/types";
import { z } from "zod";

export const VideoCropConfigSchema = z
	.object({
		leftPercentage: z.number().min(0).max(100).default(0),
		topPercentage: z.number().min(0).max(100).default(0),
		widthPercentage: z.number().min(0).max(100).default(100),
		heightPercentage: z.number().min(0).max(100).default(100),
	})
	.strict();

export type VideoCropConfig = z.infer<typeof VideoCropConfigSchema>;

export const VideoCropResultSchema = SingleOutputGenericSchema(
	createOutputItemSchema(z.literal("Video"), VirtualVideoDataSchema),
);

export type VideoCropResult = z.infer<typeof VideoCropResultSchema>;
