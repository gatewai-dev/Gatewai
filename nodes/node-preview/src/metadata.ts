import { defineMetadata } from "@gatewai/node-sdk";
import { z } from "zod";

export const PreviewNodeConfigSchema = z.object({}).strict();

export default defineMetadata({
	type: "Preview",
	displayName: "Preview",
	description: "Preview the output of a connected node",
	category: "Outputs",
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
