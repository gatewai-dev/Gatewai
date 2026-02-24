import {
	createOutputItemSchema,
	SingleOutputGenericSchema,
	VirtualVideoDataSchema,
} from "@gatewai/core/types";
import { z } from "zod";

export const VideoCutConfigSchema = z
	.object({
		startSec: z.number().min(0).default(0),
		endSec: z.number().min(0).nullable().default(null),
	})
	.strict();

export type VideoCutConfig = z.infer<typeof VideoCutConfigSchema>;

export const VideoCutResultSchema = SingleOutputGenericSchema(
	createOutputItemSchema(z.literal("Video"), VirtualVideoDataSchema),
);

export type VideoCutResult = z.infer<typeof VideoCutResultSchema>;
