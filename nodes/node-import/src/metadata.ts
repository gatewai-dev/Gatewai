import { defineMetadata } from "@gatewai/node-sdk";
import { ImportResultSchema } from "./shared/index.js";

export { ImportResultSchema };

export default defineMetadata({
	type: "Import",
	displayName: "Import",
	description: "Upload your media files",
	category: "Inputs",
	resultSchema: ImportResultSchema,
	isTerminal: false,
	isTransient: false,
	showInQuickAccess: true,
	handles: {
		inputs: [],
		outputs: [
			{
				dataTypes: [
					"Audio",
					"Image",
					"Video",
					"Lottie",
					"Json",
					"ThreeD",
					"SVG",
					"Caption",
				],
				label: "Result",
				order: 0,
			},
		],
	},
});
