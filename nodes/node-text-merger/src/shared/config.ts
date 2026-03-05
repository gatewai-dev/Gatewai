import {
	createOutputItemSchema,
	SingleOutputGenericSchema,
} from "@gatewai/core/types";
import {
	AudioResultSchema,
	ImageResultSchema,
	TextResultSchema,
	VideoResultSchema,
} from "@gatewai/node-sdk";
import { z } from "zod";

export const TextMergerNodeConfigSchema = z
	.object({
		join: z.string().optional(),
	})
	.strict();

export type TextMergerNodeConfig = z.infer<typeof TextMergerNodeConfigSchema>;

export const TextMergerResultSchema = TextResultSchema;

export type TextMergerResult = z.infer<typeof TextMergerResultSchema>;
