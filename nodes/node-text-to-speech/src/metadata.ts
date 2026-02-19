import { defineMetadata } from "@gatewai/node-sdk";
import {
	TextToSpeechNodeConfigSchema,
	TTS_LANGUAGES,
	TTS_VOICE_NAMES,
} from "./shared/index.js";

export { TextToSpeechNodeConfigSchema };

export default defineMetadata({
	type: "TextToSpeech",
	displayName: "Text to Speech",
	description: "Create speech from text",
	category: "AI",
	subcategory: "Audio",
	configSchema: TextToSpeechNodeConfigSchema,
	isTerminal: true,
	isTransient: false,
	handles: {
		inputs: [{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 }],
		outputs: [{ dataTypes: ["Audio"], label: "Audio", order: 0 }],
	},
});
