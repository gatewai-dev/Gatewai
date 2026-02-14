import { z } from "zod";

export const BlurNodeConfigSchema = z
    .object({
        size: z.number().min(0).max(100).default(5),
    })
    .strict();