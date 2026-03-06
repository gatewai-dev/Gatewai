import { z } from "zod";

export const LLM_NODE_MODELS = [
	"gemini-3.1-pro-preview",
	"gemini-3-flash-preview",
	"gemini-2.5-pro",
] as const;

export const LLMNodeConfigSchema = z
	.object({
		model: z.enum(LLM_NODE_MODELS).default("gemini-3-flash-preview"),
		temperature: z.number().min(0).max(2).optional().default(0.7),
	})
	.strict();

export type LLMNodeConfig = z.infer<typeof LLMNodeConfigSchema>;

import {
	createOutputItemSchema,
	MultiOutputGenericSchema,
} from "@gatewai/core/types";

export const LLMResultSchema = MultiOutputGenericSchema(
	createOutputItemSchema(z.literal("Text"), z.string()),
);

export type LLMResult = z.infer<typeof LLMResultSchema>;
