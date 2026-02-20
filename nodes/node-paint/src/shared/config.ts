import { DimensionSchema } from "@gatewai/node-sdk";
import { z } from "zod";

export const PaintNodeConfigSchema = z
	.object({
		width: DimensionSchema.default(1080),
		height: DimensionSchema.default(1080),
		maintainAspect: z.boolean().default(true),
		aspectRatio: z.number().optional(),
		backgroundColor: z.string().optional(),
		paintData: z.string().optional(),
	})
	.strict();

export type PaintNodeConfig = z.infer<typeof PaintNodeConfigSchema>;
