import { defineNode } from "@gatewai/node-sdk";
import { TextNodeConfigSchema } from "../../configs/text.config.js";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "Text",
	displayName: "Text",
	description: "A text input",
	category: "Inputs",
	configSchema: TextNodeConfigSchema,
	isTerminal: false,
	isTransient: false,
	showInQuickAccess: true,
	handles: {
		inputs: [],
		outputs: [{ dataTypes: ["Text"], label: "Text", order: 0 }],
	},
	defaultConfig: { content: "" },
	backendProcessor,
});
