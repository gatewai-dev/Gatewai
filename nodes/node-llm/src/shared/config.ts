import { z } from "zod";

export const LLM_NODE_MODELS = [
	"gemini-3-pro-preview",
	"gemini-3-flash-preview",
	"gpt-4o",
	"gpt-4o-mini",
	"claude-3-5-sonnet-latest",
] as const;

export const LLMNodeConfigSchema = z
	.object({
		model: z.enum(LLM_NODE_MODELS),
		prompt: z.string().optional().default(""),
		temperature: z.number().min(0).max(2).optional().default(0.7),
		maxTokens: z.number().int().positive().optional().default(2048),
	})
	.strict();

export type LLMNodeConfig = z.infer<typeof LLMNodeConfigSchema>;
