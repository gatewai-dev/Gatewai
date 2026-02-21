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

import { createOutputItemSchema, FileDataSchema } from "@gatewai/core/types";

export const PaintResultSchema = z.object({
	selectedOutputIndex: z.literal(0),
	outputs: z.tuple([
		z.object({
			items: z.tuple([
				createOutputItemSchema(z.literal("Image"), FileDataSchema),
				createOutputItemSchema(z.literal("Image"), FileDataSchema),
			]),
		}),
	]),
});

export type PaintResult = z.infer<typeof PaintResultSchema>;
