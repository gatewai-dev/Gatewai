import { defineMetadata } from "@gatewai/node-sdk";
import { z } from "zod";

const DimensionSchema = z.number().int().min(1).max(8192);

export const ResizeNodeConfigSchema = z
	.object({
		width: DimensionSchema,
		height: DimensionSchema,
		maintainAspect: z.boolean(),
		aspectRatio: z.number().optional(),
	})
	.strict();

export default defineMetadata({
	type: "Resize",
	displayName: "Resize",
	description: "Resize an image",
	category: "Image",
	configSchema: ResizeNodeConfigSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [
			{ dataTypes: ["Image"], required: true, label: "Image", order: 0 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		width: 1024,
		height: 1024,
		maintainAspect: true,
	},
});
