import { z } from "zod";

export const PreviewNodeConfigSchema = z.object({}).strict();

export type PreviewNodeConfig = z.infer<typeof PreviewNodeConfigSchema>;
