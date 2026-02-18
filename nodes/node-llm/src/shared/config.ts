import { z } from "zod";

export const LLM_NODE_MODELS = [
	"gemini-3-pro-preview",
	"gemini-3-flash-preview",
	"gemini-2.5-pro",
] as const;

export const LLMNodeConfigSchema = z
	.object({
		model: z.enum(LLM_NODE_MODELS).default("gemini-3-flash-preview"),
		temperature: z.number().min(0).max(2).optional().default(0.7)
	})
	.strict();

export type LLMNodeConfig = z.infer<typeof LLMNodeConfigSchema>;
