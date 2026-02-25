import {
	createOutputItemSchema,
	FileDataSchema,
	MultiOutputGenericSchema,
} from "@gatewai/core/types";
import { z } from "zod";

export const ImportResultSchema = z.union([
	MultiOutputGenericSchema(
		createOutputItemSchema(z.literal("Video"), FileDataSchema),
	),
	MultiOutputGenericSchema(
		createOutputItemSchema(z.literal("Image"), FileDataSchema),
	),
	MultiOutputGenericSchema(
		createOutputItemSchema(z.literal("Audio"), FileDataSchema),
	),
]);

export type ImportResult = z.infer<typeof ImportResultSchema>;
