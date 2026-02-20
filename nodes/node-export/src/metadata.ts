import { defineMetadata } from "@gatewai/node-sdk";
import { ExportNodeConfigSchema } from "./shared/index.js";

export { ExportNodeConfigSchema };

export default defineMetadata({
	type: "Export",
	displayName: "Export",
	description: "An UI download / API output node",
	category: "Outputs",
	configSchema: ExportNodeConfigSchema,
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
