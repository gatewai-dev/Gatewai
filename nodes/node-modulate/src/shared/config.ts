import {
	createOutputItemSchema,
	FileDataSchema,
	SingleOutputGenericSchema,
} from "@gatewai/core/types";
import {
	AudioResultSchema,
	ImageResultSchema,
	TextResultSchema,
	VideoResultSchema,
} from "@gatewai/node-sdk";
import { z } from "zod";

export const ModulateNodeConfigSchema = z
	.object({
		hue: z.number().min(0).max(360).default(0),
		saturation: z.number().min(0).max(2).default(1),
		lightness: z.number().min(0).max(2).default(1),
		brightness: z.number().min(0).max(2).default(1),
	})
	.strict();

export type ModulateNodeConfig = z.infer<typeof ModulateNodeConfigSchema>;

export const ModulateResultSchema = ImageResultSchema;

export type ModulateResult = z.infer<typeof ModulateResultSchema>;
