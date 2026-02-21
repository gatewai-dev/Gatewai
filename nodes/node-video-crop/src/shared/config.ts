import {
	createOutputItemSchema,
	SingleOutputGenericSchema,
	VirtualVideoDataSchema,
} from "@gatewai/core/types";
import { z } from "zod";

export const VideoCropConfigSchema = z
	.object({
		x: z.number().min(0).default(0),
		y: z.number().min(0).default(0),
		width: z.number().min(1).nullable().default(null),
		height: z.number().min(1).nullable().default(null),
	})
	.strict();

export type VideoCropConfig = z.infer<typeof VideoCropConfigSchema>;

export const VideoCropResultSchema = SingleOutputGenericSchema(
	createOutputItemSchema(z.literal("Video"), VirtualVideoDataSchema),
);

export type VideoCropResult = z.infer<typeof VideoCropResultSchema>;
