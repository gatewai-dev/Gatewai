import { defineMetadata } from "@gatewai/node-sdk";
import { z } from "zod";

export const STT_NODE_MODELS = [
	"gemini-2.5-flash",
	"gemini-3-flash-preview",
	"gemini-3-pro-preview",
] as const;

export const SpeechToTextNodeConfigSchema = z
	.object({
		model: z.enum(STT_NODE_MODELS).default("gemini-2.5-flash"),
	})
	.strict();

export default defineMetadata({
	type: "SpeechToText",
	displayName: "Audio Understanding",
	description: "Create text transcript of or extract context from an audio",
	category: "AI",
	subcategory: "Audio",
	configSchema: SpeechToTextNodeConfigSchema,
	isTerminal: true,
	isTransient: false,
	handles: {
		inputs: [
			{ dataTypes: ["Audio"], required: true, label: "Audio", order: 0 },
			{ dataTypes: ["Text"], label: "Prompt", order: 1 },
		],
		outputs: [{ dataTypes: ["Text"], label: "Result", order: 0 }],
	},
	defaultConfig: { model: "gemini-2.5-flash" },
});
