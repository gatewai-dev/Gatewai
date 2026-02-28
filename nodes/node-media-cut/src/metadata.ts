import { defineMetadata } from "@gatewai/node-sdk";
import {
	type MediaCutConfig,
	MediaCutConfigSchema,
	MediaCutResultSchema,
} from "./shared/index.js";

export { MediaCutConfigSchema, MediaCutResultSchema };

export const metadata = defineMetadata({
	type: "MediaCut",
	displayName: "Cut Media",
	description: "Trim video or audio by specifying start and end times.",
	category: "Media",
	configSchema: MediaCutConfigSchema,
	resultSchema: MediaCutResultSchema,
	isTerminal: false,
	isTransient: false,
	handles: {
		inputs: [
			{
				dataTypes: ["Video", "Audio"],
				required: true,
				label: "Media",
				order: 0,
			},
		],
		outputs: [{ dataTypes: ["Video", "Audio"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		startSec: 0,
		endSec: null,
	} as MediaCutConfig,
});
