import { AnyOutputUnionSchema } from "@gatewai/core/types";
import { z } from "zod";

export const ExportNodeConfigSchema = z.object({}).strict();

export type ExportNodeConfig = z.infer<typeof ExportNodeConfigSchema>;

export const ExportResultSchema = z.object({
	selectedOutputIndex: z.number(),
	outputs: z.array(z.object({ items: z.array(AnyOutputUnionSchema) })),
});

export type ExportResult = z.infer<typeof ExportResultSchema>;
