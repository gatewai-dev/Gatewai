import { defineNode } from "@gatewai/node-sdk";

export default defineNode({
	type: "Preview",
	displayName: "Preview",
	description: "Preview the output of a connected node",
	category: "Outputs",
	version: "1.0.0",
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
});
