import { defineMetadata } from "@gatewai/node-sdk";
import {
	type SvgNodeConfig,
	SvgNodeConfigSchema,
	SvgResultSchema,
} from "./shared/index.js";

export { SvgNodeConfigSchema, SvgResultSchema };

export const metadata = defineMetadata({
	type: "SvgGen",
	displayName: "SVG Generator",
	description: "Generate or edit SVG vector graphics using an AI model.",
	category: "AI",
	configSchema: SvgNodeConfigSchema,
	resultSchema: SvgResultSchema,
	isTerminal: true,
	isTransient: false,
	variableInputs: { enabled: false, dataTypes: ["SVG"] },
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{ dataTypes: ["SVG"], label: "Source SVG (Editing)", order: 1 },
		],
		outputs: [{ dataTypes: ["SVG"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		model: "gemini-3-flash-preview",
		autoDimensions: true,
		width: 1080,
		height: 1080,
	},
	pricing: (config: SvgNodeConfig) => {
		const MODEL_TOKEN_PRICING: Record<SvgNodeConfig["model"], number> = {
			"gemini-3-flash-preview": 5,
			"gemini-3.1-pro-preview": 15,
			"gemini-2.5-pro": 10,
		};
		return MODEL_TOKEN_PRICING[config.model] || 10;
	},
});
