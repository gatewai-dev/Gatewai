import { defineNode } from "@gatewai/node-sdk";

export default defineNode({
	type: "Note",
	displayName: "Sticky Note",
	description: "A sticky note",
	category: "Tools",
	version: "1.0.0",
	isTerminal: false,
	isTransient: false,
	handles: {
		inputs: [],
		outputs: [],
	},
	defaultConfig: { backgroundColor: "#ffff88", textColor: "#000" },
});
