import {
	createOutputItemSchema,
	MultiOutputGenericSchema,
	VirtualMediaDataSchema,
} from "@gatewai/core/types";
import { z } from "zod";

export const LOTTIE_NODE_MODELS = [
	"gemini-3.1-pro-preview",
	"gemini-3-flash-preview",
	"gemini-2.5-pro",
] as const;

export const LottieNodeConfigSchema = z
	.object({
		model: z.enum(LOTTIE_NODE_MODELS),
		temperature: z.number().min(0).max(2).default(0),
	})
	.strict();

export type LottieNodeConfig = z.infer<typeof LottieNodeConfigSchema>;

export const LottieResultSchema = MultiOutputGenericSchema(
	createOutputItemSchema(z.literal("Lottie"), VirtualMediaDataSchema),
);

export type LottieResult = z.infer<typeof LottieResultSchema>;
