import { defineMetadata } from "@gatewai/node-sdk";
import { z } from "zod";

export const FileNodeConfigSchema = z.object({}).strict();

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
