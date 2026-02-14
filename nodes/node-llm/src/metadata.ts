import { defineMetadata } from "@gatewai/node-sdk";
import { z } from "zod";

export const LLM_NODE_MODELS = [
	"gemini-2.5-flash",
	"gemini-2.5-pro",
	"gemini-3-flash-preview",
	"gemini-3-pro-preview",
] as const;

export const LLMNodeConfigSchema = z
	.object({
		model: z.enum(LLM_NODE_MODELS).default("gemini-2.5-flash"),
		temperature: z.number().min(0).max(2).default(1),
	})
	.strict();

export default defineMetadata({
	type: "LLM",
	displayName: "LLM",
	description: "Prompt a large language model",
	category: "AI",
	subcategory: "Text",
	configSchema: LLMNodeConfigSchema,
	isTerminal: true,
	isTransient: false,
	variableInputs: { enabled: true, dataTypes: ["Text", "Image"] },
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{ dataTypes: ["Text"], label: "System Prompt", order: 1 },
		],
		outputs: [{ dataTypes: ["Text"], label: "Output", order: 0 }],
	},
	defaultConfig: { model: "gemini-2.5-flash", temperature: 1 },
});
