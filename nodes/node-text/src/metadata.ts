import { defineMetadata } from "@gatewai/node-sdk";
import { TextNodeConfigSchema } from "./shared/index.js";

export { TextNodeConfigSchema };

export const metadata = defineMetadata({
	type: "Text",
	displayName: "Text",
	description: "Text (prompt) input node",
	category: "Inputs",
	showInQuickAccess: true,
	configSchema: TextNodeConfigSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [],
		outputs: [{ dataTypes: ["Text"], label: "Result", order: 0 }],
	},
	defaultConfig: { content: "" },
});
