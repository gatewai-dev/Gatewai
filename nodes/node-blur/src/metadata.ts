import { defineClient } from "@gatewai/node-sdk/browser";
import { defineMetadata, defineNode } from "@gatewai/node-sdk/server";
import { z } from "zod";
import { BlurProcessor } from "./browser/processor.js";
import { BlurNodeConfigSchema } from "./shared/config.js";

export const metadata = defineMetadata({
	type: "Blur",
	displayName: "Blur",
	description: "Apply blur to an image",
	category: "Image",
	configSchema: BlurNodeConfigSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [
			{ dataTypes: ["Image"], required: true, label: "Image", order: 0 },
		],
		outputs: [{ dataTypes: ["Image"], label: "Result", order: 0 }],
	},
	defaultConfig: { size: 5 },
});

export default defineNode(metadata, {
	backendProcessor: BlurProcessor,
});
