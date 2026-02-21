// ─── Node Manifest ──────────────────────────────────────────────────────────

import type { DataType } from "@gatewai/db";
import z, { type ZodTypeAny } from "zod";

const HandleDefinitionSchema = z.object({
	dataTypes: z.custom<DataType[]>(),
	label: z.string(),
	required: z.boolean().optional(),
	order: z.number(),
	description: z.string().optional(),
});

/**
 * Metadata defining the interface and identity of a node.
 * This is safe to import in any environment.
 */
export const NodeMetadataSchema = z.object({
	// Identity
	type: z.string().min(1),
	displayName: z.string().min(1),
	description: z.string().optional(),
	category: z.string().min(1),
	subcategory: z.string().optional(),
	showInQuickAccess: z.boolean().optional(),
	showInSidebar: z.boolean().optional(),

	// I/O Contract
	handles: z.object({
		inputs: z.array(HandleDefinitionSchema),
		outputs: z.array(HandleDefinitionSchema),
	}),
	variableInputs: z
		.object({
			enabled: z.boolean(),
			dataTypes: z.custom<DataType[]>(),
		})
		.optional(),
	variableOutputs: z
		.object({
			enabled: z.boolean(),
			dataTypes: z.custom<DataType[]>(),
		})
		.optional(),

	// Execution Flags
	isTerminal: z.boolean(),
	isTransient: z.boolean().optional(),

	// Config
	configSchema: z.custom<ZodTypeAny>().optional(),
	defaultConfig: z.record(z.unknown()).optional(),

	// Results
	resultSchema: z.custom<ZodTypeAny>().optional(),
});

export type NodeMetadata = z.infer<typeof NodeMetadataSchema>;
