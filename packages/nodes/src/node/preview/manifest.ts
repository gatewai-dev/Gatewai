import { defineNode } from "@gatewai/node-sdk";
import PreviewProcessor from "./processor.js";

export default defineNode({
	type: "Preview",
	displayName: "Preview",
	description: "Preview the output of a connected node",
	category: "Outputs",
	isTerminal: false,
	isTransient: true,
	showInQuickAccess: true,
	handles: {
		inputs: [
			{
				dataTypes: ["Video", "Image", "Text", "Audio"],
				required: true,
				label: "Input",
				order: 0,
			},
		],
		outputs: [],
	},
	backendProcessor: PreviewProcessor,
});
