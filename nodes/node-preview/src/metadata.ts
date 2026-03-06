import { defineMetadata } from "@gatewai/node-sdk";
import { PreviewNodeConfigSchema } from "./shared/index.js";

export { PreviewNodeConfigSchema };

export default defineMetadata({
	type: "Preview",
	displayName: "Preview",
	description: "Preview the output of a connected node",
	category: "Tools",
	configSchema: PreviewNodeConfigSchema,
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
