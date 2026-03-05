import { TextResultSchema } from "@gatewai/node-sdk";
import { z } from "zod";

export const TextNodeConfigSchema = z
	.object({
		content: z.string().default(""),
	})
	.strict();

export type TextNodeConfig = z.infer<typeof TextNodeConfigSchema>;

export type TextNodeResult = z.infer<typeof TextResultSchema>;
export { TextResultSchema };
