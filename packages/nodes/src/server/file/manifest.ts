import { defineNode } from "@gatewai/node-sdk";
import { FileNodeConfigSchema } from "../../configs/file.config.js";
import FileProcessor from "./processor.js";

export default defineNode({
	type: "File",
	displayName: "Import",
	description: "Upload your media files",
	category: "Inputs",
	configSchema: FileNodeConfigSchema,
	isTerminal: false,
	isTransient: false,
	showInQuickAccess: true,
	handles: {
		inputs: [],
		outputs: [
			{ dataTypes: ["Audio", "Image", "Video"], label: "File", order: 0 },
		],
	},
	backendProcessor: FileProcessor,
});
