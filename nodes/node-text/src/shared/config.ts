import {
	createOutputItemSchema,
	SingleOutputGenericSchema,
} from "@gatewai/core/types";
import { z } from "zod";

export const TextNodeConfigSchema = z
	.object({
		content: z.string().default(""),
	})
	.strict();

export type TextNodeConfig = z.infer<typeof TextNodeConfigSchema>;

export const TextResultSchema = SingleOutputGenericSchema(
	createOutputItemSchema(z.literal("Text"), z.string()),
);

export type TextResult = z.infer<typeof TextResultSchema>;
