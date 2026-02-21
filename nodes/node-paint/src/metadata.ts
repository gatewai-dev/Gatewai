import { defineMetadata } from "@gatewai/node-sdk";
import { PaintNodeConfigSchema, PaintResultSchema } from "./shared/index.js";

export { PaintNodeConfigSchema, PaintResultSchema };

export default defineMetadata({
	type: "Paint",
	displayName: "Paint",
	description: "Draw / Fill Mask on an image",
	category: "Image",
	configSchema: PaintNodeConfigSchema,
	resultSchema: PaintResultSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [
			{
				dataTypes: ["Image"],
				label: "Background Image",
				order: 0,
				required: false,
			},
		],
		outputs: [
			{
				dataTypes: ["Image"],
				label: "Image",
				order: 0,
				description: "Image output, with mask",
			},
			{
				dataTypes: ["Image"],
				label: "Mask",
				order: 1,
				description: "Image output, only mask",
			},
		],
	},
	defaultConfig: {
		width: 1080,
		height: 1080,
		maintainAspect: true,
		backgroundColor: "#000",
	},
});
