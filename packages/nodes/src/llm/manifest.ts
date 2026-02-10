import { defineNode } from "@gatewai/node-sdk";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "LLM",
	displayName: "LLM",
	description: "Run a LLM model",
	category: "AI",
	version: "1.0.0",
	isTerminal: true,
	isTransient: false,
	variableInputs: { enabled: true, dataTypes: ["Image"] },
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{
				dataTypes: ["Text"],
				required: false,
				label: "System Prompt",
				order: 1,
			},
			{ dataTypes: ["Image"], required: false, label: "Image", order: 2 },
		],
		outputs: [{ dataTypes: ["Text"], label: "Text", order: 0 }],
	},
	defaultConfig: { model: "gemini-3-flash-preview", temperature: 0 },
	backendProcessor,
});
