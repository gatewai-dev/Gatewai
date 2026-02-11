import { z } from "zod";
import { PercentageSchema } from "../common/schemas.js";

export const CropNodeConfigSchema = z
    .object({
        leftPercentage: PercentageSchema,
        topPercentage: PercentageSchema,
        widthPercentage: PercentageSchema,
        heightPercentage: PercentageSchema,
    })
    .strict();

export type CropNodeConfig = z.infer<typeof CropNodeConfigSchema>;
