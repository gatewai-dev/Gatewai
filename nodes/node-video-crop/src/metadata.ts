import { defineMetadata } from "@gatewai/node-sdk";
import {
	type VideoCropConfig,
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
		leftPercentage: 0,
		topPercentage: 0,
		widthPercentage: 100,
		heightPercentage: 100,
	} as VideoCropConfig,
});
