import { z } from "zod";

const ColorSchema = z.string().regex(/^#([0-9a-fA-F]{3,8})$/);

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
