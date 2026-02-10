import { defineNode } from "@gatewai/node-sdk";

export default defineNode({
	type: "File",
	displayName: "Import",
	description: "Upload your media files",
	category: "Inputs",
	version: "1.0.0",
	isTerminal: false,
	isTransient: false,
	showInQuickAccess: true,
	handles: {
		inputs: [],
		outputs: [
			{ dataTypes: ["Audio", "Image", "Video"], label: "File", order: 0 },
		],
	},
});
