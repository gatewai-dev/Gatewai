import { defineMetadata } from "@gatewai/node-sdk";
import { NoteNodeConfigSchema } from "./shared/index.js";

export { NoteNodeConfigSchema };

export default defineMetadata({
	type: "Note",
	displayName: "Sticky Note",
	description: "A sticky note",
	category: "Tools",
	configSchema: NoteNodeConfigSchema,
	isTerminal: false,
	isTransient: false,
	handles: {
		inputs: [],
		outputs: [],
	},
	defaultConfig: { backgroundColor: "#ffff88", textColor: "#000" },
});
