import { defineMetadata } from "@gatewai/node-sdk";
import { ExportNodeConfigSchema, ExportResultSchema } from "./shared/index.js";

export { ExportNodeConfigSchema, ExportResultSchema };

export default defineMetadata({
	type: "Export",
	displayName: "Export",
	description: "An UI download / API output node",
	category: "Outputs",
	configSchema: ExportNodeConfigSchema,
	resultSchema: ExportResultSchema,
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
});
