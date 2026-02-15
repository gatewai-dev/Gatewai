import { z } from "zod";

export const PaintNodeConfigSchema = z
	.object({
		width: z.number().min(0).default(1024),
		height: z.number().min(0).default(1024),
		maintainAspect: z.boolean().default(true),
		backgroundColor: z.string().optional(),
	})
	.strict();

export type PaintNodeConfig = z.infer<typeof PaintNodeConfigSchema>;
