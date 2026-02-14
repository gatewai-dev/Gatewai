import { z } from "zod";

export const TextNodeConfigSchema = z
	.object({
		content: z.string().optional(),
	})
	.strict();

export type TextNodeConfig = z.infer<typeof TextNodeConfigSchema>;
