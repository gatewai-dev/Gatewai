import { z } from "zod";

export const ImportNodeConfigSchema = z
	.object({
		asset: z.any().optional(),
	})
	.strict();

export type ImportNodeConfig = z.infer<typeof ImportNodeConfigSchema>;
