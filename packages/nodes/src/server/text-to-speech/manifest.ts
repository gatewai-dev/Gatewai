import { defineNode } from "@gatewai/node-sdk";
import { TextToSpeechNodeConfigSchema } from "../../configs/text-to-speech.config.js";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "TextToSpeech",
	displayName: "Text to Speech",
	description: "Create audio using text",
	category: "AI",
	subcategory: "Audio",
	configSchema: TextToSpeechNodeConfigSchema,
	isTerminal: true,
	isTransient: false,
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
		],
		outputs: [{ dataTypes: ["Audio"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		model: "gemini-2.5-flash-preview-tts",
		voiceName: "Kore",
		languageCode: "en-US",
	},
	backendProcessor,
});
