import {
	createOutputItemSchema,
	SingleOutputGenericSchema,
} from "@gatewai/core/types";
import { z } from "zod";

export const TextMergerNodeConfigSchema = z
	.object({
		join: z.string().optional(),
	})
	.strict();

export type TextMergerNodeConfig = z.infer<typeof TextMergerNodeConfigSchema>;

export const TextMergerResultSchema = SingleOutputGenericSchema(
	createOutputItemSchema(z.literal("Text"), z.string()),
);

export type TextMergerResult = z.infer<typeof TextMergerResultSchema>;
