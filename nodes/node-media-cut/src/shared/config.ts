import {
	createOutputItemSchema,
	SingleOutputGenericSchema,
	VirtualMediaDataSchema,
} from "@gatewai/core/types";
import { z } from "zod";

export const MediaCutConfigSchema = z
	.object({
		startSec: z.number().min(0).default(0),
		endSec: z.number().min(0).nullable().default(null),
	})
	.strict();

export type MediaCutConfig = z.infer<typeof MediaCutConfigSchema>;

export const MediaCutResultSchema = SingleOutputGenericSchema(
	z.union([
		createOutputItemSchema(z.literal("Video"), VirtualMediaDataSchema),
		createOutputItemSchema(z.literal("Audio"), VirtualMediaDataSchema),
	]),
);

export type MediaCutResult = z.infer<typeof MediaCutResultSchema>;
