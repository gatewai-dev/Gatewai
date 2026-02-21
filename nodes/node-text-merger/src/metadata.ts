import { defineMetadata } from "@gatewai/node-sdk";
import {
	TextMergerNodeConfigSchema,
	TextMergerResultSchema,
} from "./shared/index.js";

export { TextMergerNodeConfigSchema, TextMergerResultSchema };

export default defineMetadata({
	type: "TextMerger",
	displayName: "Text Merger",
	description: "Merges connected texts.",
	category: "Tools",
	configSchema: TextMergerNodeConfigSchema,
	resultSchema: TextMergerResultSchema,
	isTerminal: false,
	isTransient: false,
	variableInputs: { enabled: true, dataTypes: ["Text"] },
	handles: {
		inputs: [
			{ dataTypes: ["Text"], label: "Text", order: 0 },
			{ dataTypes: ["Text"], label: "Text 2", order: 1 },
		],
		outputs: [{ dataTypes: ["Text"], label: "Merged Text", order: 0 }],
	},
	defaultConfig: { join: " " },
});
