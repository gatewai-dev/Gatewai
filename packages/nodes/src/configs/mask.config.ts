import { z } from "zod";

export const MaskNodeConfigSchema = z.object({}).strict();

export type MaskNodeConfig = z.infer<typeof MaskNodeConfigSchema>;
