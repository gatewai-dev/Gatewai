import { defineMetadata } from "@gatewai/node-sdk";
import {
	type VideoCutConfig,
	VideoCutConfigSchema,
	VideoCutResultSchema,
} from "./shared/index.js";

export { VideoCutConfigSchema, VideoCutResultSchema };

export const metadata = defineMetadata({
	type: "VideoCut",
	displayName: "Cut Video",
	description: "Trim a video by specifying start and end times.",
	category: "Video",
	configSchema: VideoCutConfigSchema,
	resultSchema: VideoCutResultSchema,
	isTerminal: false,
	isTransient: false,
	handles: {
		inputs: [
			{ dataTypes: ["Video"], required: true, label: "Video", order: 0 },
		],
		outputs: [{ dataTypes: ["Video"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		startSec: 0,
		endSec: null,
	} as VideoCutConfig,
});
