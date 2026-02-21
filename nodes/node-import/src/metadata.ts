import { defineMetadata } from "@gatewai/node-sdk";
import { ImportNodeConfigSchema, ImportResultSchema } from "./shared/index.js";

export { ImportNodeConfigSchema, ImportResultSchema };

export default defineMetadata({
	type: "Import",
	displayName: "Import",
	description: "Upload your media files",
	category: "Inputs",
	configSchema: ImportNodeConfigSchema,
	resultSchema: ImportResultSchema,
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
