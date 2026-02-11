import { z } from "zod";

export const LLM_NODE_MODELS = [
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
] as const;

export const LLMNodeConfigSchema = z
    .object({
        model: z.string().optional(),
        systemPrompt: z.string().optional(),
        prompt: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().positive().optional(),
        jsonMode: z.boolean().optional(),
        outputSchema: z.string().optional(),
    })
    .strict();

export type LLMNodeConfig = z.infer<typeof LLMNodeConfigSchema>;
