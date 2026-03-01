import { NodePricingSchema } from "@gatewai/core/pricing";
import { defineMetadata } from "@gatewai/node-sdk";
import { LLMNodeConfigSchema, LLMResultSchema } from "./shared/index.js";

export { LLMNodeConfigSchema, LLMResultSchema };

export const metadata = defineMetadata({
	type: "LLM",
	displayName: "LLM",
	description: "Prompt a large language model",
	category: "AI",
	subcategory: "Text",
	configSchema: LLMNodeConfigSchema,
	resultSchema: LLMResultSchema,
	isTerminal: true,
	isTransient: false,
	variableInputs: { enabled: true, dataTypes: ["Image"] },
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{ dataTypes: ["Text"], label: "System Prompt", order: 1 },
		],
		outputs: [{ dataTypes: ["Text"], label: "Result", order: 0 }],
	},
	defaultConfig: { model: "gemini-3-flash-preview", temperature: 0 },
	pricing: {
		price: 10,
		variantPrices: {
			"gemini-3.1-pro-preview": 50,
			"gemini-3-flash-preview": 10,
			"gemini-2.5-pro": 30,
		},
	},
});
