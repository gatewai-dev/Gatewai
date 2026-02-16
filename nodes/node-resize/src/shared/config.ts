import { DimensionSchema } from "@gatewai/node-sdk";
import { z } from "zod";

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
