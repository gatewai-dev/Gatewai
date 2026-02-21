import {
	createOutputItemSchema,
	FileDataSchema,
	SingleOutputGenericSchema,
} from "@gatewai/core/types";
import { z } from "zod";

export const BlurNodeConfigSchema = z
	.object({
		size: z.number().min(0).max(100).default(5),
	})
	.strict();

export type BlurNodeConfig = z.infer<typeof BlurNodeConfigSchema>;

export const BlurResultSchema = SingleOutputGenericSchema(
	createOutputItemSchema(z.literal("Image"), FileDataSchema),
);

export type BlurResult = z.infer<typeof BlurResultSchema>;
