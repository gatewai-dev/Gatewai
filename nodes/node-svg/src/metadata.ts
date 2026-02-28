import { defineMetadata } from "@gatewai/node-sdk";
import { SvgNodeConfigSchema, SvgResultSchema } from "./shared/index.js";

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
	variableInputs: { enabled: true, dataTypes: ["SVG"] },
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{ dataTypes: ["SVG"], label: "Source SVG (Editing)", order: 1 },
		],
		outputs: [{ dataTypes: ["SVG"], label: "Result", order: 0 }],
	},
	defaultConfig: { model: "gemini-3-flash-preview", temperature: 0 },
});
