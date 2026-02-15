import { defineMetadata } from "@gatewai/node-sdk";
import { FileNodeConfigSchema } from "./shared/index.js";

export { FileNodeConfigSchema };

export default defineMetadata({
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
});
