import { defineMetadata } from "@gatewai/node-sdk";
import { LLMNodeConfigSchema } from "./shared/index.js";

export { LLMNodeConfigSchema };

export default defineMetadata({
	type: "LLM",
	displayName: "LLM",
	description: "Prompt a large language model",
	category: "AI",
	subcategory: "Text",
	configSchema: LLMNodeConfigSchema,
	isTerminal: true,
	isTransient: false,
	variableInputs: { enabled: true, dataTypes: ["Image"] },
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{ dataTypes: ["Text"], label: "System Prompt", order: 1 },
		],
		outputs: [{ dataTypes: ["Text"], label: "Output", order: 0 }],
	},
	defaultConfig: { model: "gemini-3-flash-preview", temperature: 0 },
});
