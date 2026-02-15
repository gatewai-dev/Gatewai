import { defineMetadata } from "@gatewai/node-sdk";

export { PaintNodeConfigSchema } from "./shared/config.js";

import { PaintNodeConfigSchema } from "./shared/config.js";

export default defineMetadata({
	type: "Paint",
	displayName: "Paint",
	description: "Draw / Fill Mask on an image",
	category: "Image",
	configSchema: PaintNodeConfigSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [
			{
				dataTypes: ["Image"],
				label: "Background Image",
				order: 0,
				required: true,
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
		width: 1024,
		height: 1024,
		maintainAspect: true,
		backgroundColor: "#000",
	},
});
