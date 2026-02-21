import { defineMetadata } from "@gatewai/node-sdk";
import { TextNodeConfigSchema, TextResultSchema } from "./shared/index.js";

export { TextNodeConfigSchema, TextResultSchema };

export const metadata = defineMetadata({
	type: "Text",
	displayName: "Text",
	description: "Text (prompt) input node",
	category: "Inputs",
	showInQuickAccess: true,
	configSchema: TextNodeConfigSchema,
	resultSchema: TextResultSchema,
	isTerminal: false,
	isTransient: true,
	handles: {
		inputs: [],
		outputs: [{ dataTypes: ["Text"], label: "Result", order: 0 }],
	},
	defaultConfig: { content: "" },
});
