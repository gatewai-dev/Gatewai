import { defineNode } from "@gatewai/node-sdk";
import { TextMergerNodeConfigSchema } from "../../configs/text-merger.config.js";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "TextMerger",
	displayName: "Text Merger",
	description: "Merges connected texts.",
	category: "Tools",
	configSchema: TextMergerNodeConfigSchema,
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
	backendProcessor,
});
