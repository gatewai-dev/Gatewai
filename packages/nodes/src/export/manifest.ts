import { defineNode } from "@gatewai/node-sdk";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "Export",
	displayName: "Export",
	description: "An UI download / API output node",
	category: "Outputs",
	version: "1.0.0",
	isTerminal: true,
	isTransient: false,
	showInQuickAccess: true,
	handles: {
		inputs: [
			{
				dataTypes: ["Text", "Image", "Video", "Audio"],
				required: true,
				label: "Input",
				order: 0,
			},
		],
		outputs: [],
	},
	backendProcessor,
});
