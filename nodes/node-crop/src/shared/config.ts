import z from "zod";

const PercentageSchema = z.number().min(0).max(100).default(0);

export const CropNodeConfigSchema = z
	.object({
		leftPercentage: PercentageSchema,
		topPercentage: PercentageSchema,
		widthPercentage: PercentageSchema,
		heightPercentage: PercentageSchema,
	})
	.strict();

export type CropNodeConfig = z.infer<typeof CropNodeConfigSchema>;
