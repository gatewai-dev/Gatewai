import { z } from "zod";

const DimensionSchema = z.number().int().min(1).max(8192);

export const ResizeNodeConfigSchema = z
	.object({
		width: DimensionSchema,
		height: DimensionSchema,
		maintainAspect: z.boolean(),
		aspectRatio: z.number().optional(),
		originalWidth: z.number().optional(),
		originalHeight: z.number().optional(),
	})
	.strict();

export type ResizeNodeConfig = z.infer<typeof ResizeNodeConfigSchema>;
