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
	MultiOutputGenericSchema(
		createOutputItemSchema(z.literal("Lottie"), FileDataSchema),
	),
	MultiOutputGenericSchema(
		createOutputItemSchema(z.literal("Json"), FileDataSchema),
	),
	MultiOutputGenericSchema(
		createOutputItemSchema(z.literal("SVG"), FileDataSchema),
	),
	MultiOutputGenericSchema(
		createOutputItemSchema(z.literal("Caption"), FileDataSchema),
	),
]);

export type ImportResult = z.infer<typeof ImportResultSchema>;
