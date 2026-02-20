import { defineMetadata } from "@gatewai/node-sdk";
import { ImportNodeConfigSchema } from "./shared/index.js";

export { ImportNodeConfigSchema };

export default defineMetadata({
	type: "Import",
	displayName: "Import",
	description: "Upload your media files",
	category: "Inputs",
	configSchema: ImportNodeConfigSchema,
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
