import { z } from "zod";
import { DimensionSchema } from "../common/schemas.js";

export const ResizeNodeConfigSchema = z
    .object({
        originalWidth: DimensionSchema,
        originalHeight: DimensionSchema,
        width: DimensionSchema,
        height: DimensionSchema,
        maintainAspect: z.boolean().optional(),
        aspectRatio: z.number().optional(),
    })
    .strict();

export type ResizeNodeConfig = z.infer<typeof ResizeNodeConfigSchema>;
