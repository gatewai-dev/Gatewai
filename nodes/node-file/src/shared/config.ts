import { z } from "zod";

export const FileNodeConfigSchema = z.object({}).strict();

export type FileNodeConfig = z.infer<typeof FileNodeConfigSchema>;
