import { z } from "zod";

export const TextMergerNodeConfigSchema = z
	.object({
		join: z.string().optional(),
	})
	.strict();

export type TextMergerNodeConfig = z.infer<typeof TextMergerNodeConfigSchema>;
