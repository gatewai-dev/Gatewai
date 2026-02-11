import { z } from "zod";

export const ExportNodeConfigSchema = z.object({}).strict();

export type ExportNodeConfig = z.infer<typeof ExportNodeConfigSchema>;
