import { defineNode } from "@gatewai/node-sdk";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "SpeechToText",
	displayName: "Audio Understanding",
	description: "Create text transcript of or extract context from an audio",
	category: "AI",
	subcategory: "Audio",
	version: "1.0.0",
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
	backendProcessor,
});
