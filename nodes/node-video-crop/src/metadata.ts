import { defineMetadata } from "@gatewai/node-sdk";
import {
	VideoCropConfigSchema,
	VideoCropResultSchema,
} from "./shared/index.js";

export { VideoCropConfigSchema, VideoCropResultSchema };

export const metadata = defineMetadata({
	type: "VideoCrop",
	displayName: "Crop Video",
	description: "Crop the visible area of a video clip.",
	category: "Video",
	configSchema: VideoCropConfigSchema,
	resultSchema: VideoCropResultSchema,
	isTerminal: false,
	isTransient: false,
	handles: {
		inputs: [
			{ dataTypes: ["Video"], required: true, label: "Video", order: 0 },
		],
		outputs: [{ dataTypes: ["Video"], label: "Result", order: 0 }],
	},
	defaultConfig: {
		x: 0,
		y: 0,
		width: null,
		height: null,
	},
});
