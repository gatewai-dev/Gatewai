import { defineNode } from "@gatewai/node-sdk";
import backendProcessor from "./processor.js";

export default defineNode({
	type: "Paint",
	displayName: "Paint",
	description: "Draw / Fill Mask on an image",
	category: "Image",
	version: "1.0.0",
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [{ dataTypes: ["Image"], label: "Background Image", order: 0 }],
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
	backendProcessor,
});
