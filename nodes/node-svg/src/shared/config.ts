import {
	createOutputItemSchema,
	MultiOutputGenericSchema,
	VirtualMediaDataSchema,
} from "@gatewai/core/types";
import { z } from "zod";

export const SVG_NODE_MODELS = [
	"gemini-3.1-pro-preview",
	"gemini-3-flash-preview",
	"gemini-2.5-pro",
] as const;

export const SvgNodeConfigSchema = z
	.object({
		model: z.enum(SVG_NODE_MODELS),
		temperature: z.number().min(0).max(2).default(0),
	})
	.strict();

export type SvgNodeConfig = z.infer<typeof SvgNodeConfigSchema>;

export const SvgResultSchema = MultiOutputGenericSchema(
	createOutputItemSchema(z.literal("SVG"), VirtualMediaDataSchema),
);

export type SvgResult = z.infer<typeof SvgResultSchema>;
