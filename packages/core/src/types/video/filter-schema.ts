import { z } from "zod";

export const CSSFilterSchema = z.object({
	brightness: z.number().min(0).max(200).default(100),
	contrast: z.number().min(0).max(200).default(100),
	saturation: z.number().min(0).max(200).default(100),
	hueRotate: z.number().min(-180).max(180).default(0),
	blur: z.number().min(0).max(20).default(0),
	grayscale: z.number().min(0).max(100).default(0),
	sepia: z.number().min(0).max(100).default(0),
	invert: z.number().min(0).max(100).default(0),
});

export const VideoFilterSchema = z.object({
	cssFilters: CSSFilterSchema.optional(),
});
