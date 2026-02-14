import { z } from "zod";

export const LLM_NODE_MODELS = [
	"gemini-3-pro-preview",
	"gemini-3-flash-preview",
] as const;

export const LLMNodeConfigSchema = z
	.object({
		model: z.enum(LLM_NODE_MODELS),
		temperature: z.number().min(0).max(2).optional().default(0),
	})
	.strict();

export type LLMNodeConfig = z.infer<typeof LLMNodeConfigSchema>;
