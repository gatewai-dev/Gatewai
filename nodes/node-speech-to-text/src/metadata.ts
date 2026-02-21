import { defineMetadata } from "@gatewai/node-sdk";
import {
	SpeechToTextNodeConfigSchema,
	SpeechToTextResultSchema,
} from "./shared/index.js";

export { SpeechToTextNodeConfigSchema, SpeechToTextResultSchema };

export default defineMetadata({
	type: "SpeechToText",
	displayName: "Audio Understanding",
	description: "Create text transcript of or extract context from an audio",
	category: "AI",
	subcategory: "Audio",
	configSchema: SpeechToTextNodeConfigSchema,
	resultSchema: SpeechToTextResultSchema,
	isTerminal: true,
	isTransient: false,
	handles: {
		inputs: [
			{ dataTypes: ["Audio"], required: true, label: "Audio", order: 0 },
			{ dataTypes: ["Text"], label: "Prompt", order: 1 },
		],
		outputs: [{ dataTypes: ["Text"], label: "Result", order: 0 }],
	},
	defaultConfig: { model: "gemini-3-flash-preview" },
});
