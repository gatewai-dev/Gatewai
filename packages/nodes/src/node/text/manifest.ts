import { defineNode } from "@gatewai/node-sdk";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "Text",
	displayName: "Text",
	description: "A text input",
	category: "Inputs",
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
