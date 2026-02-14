import { defineMetadata } from "@gatewai/node-sdk";
import { z } from "zod";

export const TextNodeConfigSchema = z
	.object({
		content: z.string().default(""),
	})
	.strict();

export const metadata = defineMetadata({
	type: "Text",
	displayName: "Text",
	description: "Input or display text",
	category: "Text",
	configSchema: TextNodeConfigSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [],
		outputs: [{ dataTypes: ["Text"], label: "Result", order: 0 }],
	},
	defaultConfig: { text: "" },
});
