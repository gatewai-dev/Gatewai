import z from "zod";
import { DataTypes } from "../types/base.js";
import {
	ConfigSchemaRegistry,
	NodeConfigSchema,
} from "../types/config/schemas.js";

export const handleSchema = z.object({
	id: z.string().optional(),
	type: z.enum(["Input", "Output"]),
	dataTypes: z.array(z.enum(DataTypes)),
	label: z.string(),
	order: z.number().default(0),
	required: z.boolean().default(false),
	templateHandleId: z.string().optional().nullable(),
	nodeId: z.string(),
});

export const nodeSchema = z
	.object({
		id: z.string().optional(),
		name: z.string(),
		// Type is now a string to support dynamic node registration
		type: z.string(),
		position: z.object({
			x: z.number(),
			y: z.number(),
		}),
		handles: z.array(handleSchema).optional(),
		width: z.number().optional().default(340),
		height: z
			.number()
			.optional()
			.nullable()
			.describe("It is better to keep this undefined for auto-style"),
		result: z
			.record(z.unknown())
			.optional()
			.nullable()
			.describe("The output data from this node"),
		config: NodeConfigSchema.optional()
			.nullable()
			.describe("Configuration parameters for this node"),
		zIndex: z.number().optional(),
		templateId: z.string(),
	})
	.superRefine((node, ctx) => {
		const schema = ConfigSchemaRegistry.get(node.type);
		if (schema && node.config) {
			const result = schema.safeParse(node.config);
			if (!result.success) {
				result.error.issues.forEach((issue) => {
					ctx.addIssue({
						...issue,
						path: ["config", ...issue.path],
					});
				});
			}
		}
	});

export const edgeSchema = z.object({
	id: z.string().optional(),
	source: z.string().describe("Source Node ID"),
	target: z.string().describe("Target Node ID"),
	sourceHandleId: z.string().optional(),
	targetHandleId: z.string().optional(),
});
