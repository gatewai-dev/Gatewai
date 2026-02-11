import { z } from "zod";

export const ModulateNodeConfigSchema = z
    .object({
        hue: z.number().min(0).max(360).default(0),
        saturation: z.number().min(0).max(10).default(1),
        lightness: z.number().min(0).max(10).default(1),
        brightness: z.number().min(0).max(10).default(1),
    })
    .strict();

export type ModulateNodeConfig = z.infer<typeof ModulateNodeConfigSchema>;
