import { defineMetadata } from "@gatewai/node-sdk";
import { z } from "zod";

export const ModulateNodeConfigSchema = z
	.object({
		hue: z.number().min(0).max(360).default(0),
		saturation: z.number().min(0).max(10).default(1),
		lightness: z.number().min(0).max(10).default(1),
		brightness: z.number().min(0).max(10).default(1),
	})
	.strict();

export default defineMetadata({
	type: "Modulate",
	displayName: "Modulate",
	description: "Apply Modulate adjustments to an image",
	category: "Image",
	configSchema: ModulateNodeConfigSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [
			{ dataTypes: ["Image"], required: true, label: "Image", order: 0 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: { hue: 0, saturation: 1, lightness: 1, brightness: 1 },
});
