import { z } from "zod";
import { ColorSchema } from "../common/schemas.js";

export const PaintNodeConfigSchema = z
	.object({
		width: z.number().int(),
		height: z.number().int(),
		maintainAspect: z.boolean(),
		aspectRatio: z.number().optional(),
		backgroundColor: ColorSchema,
		paintData: z.string().optional(),
	})
	.strict();

export type PaintNodeConfig = z.infer<typeof PaintNodeConfigSchema>;
