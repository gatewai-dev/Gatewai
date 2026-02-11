import { defineNode } from "@gatewai/node-sdk";
import NoteProcessor from "./processor.js";

export default defineNode({
	type: "Note",
	displayName: "Sticky Note",
	description: "A sticky note",
	category: "Tools",
	isTerminal: false,
	isTransient: false,
	handles: {
		inputs: [],
		outputs: [],
	},
	defaultConfig: { backgroundColor: "#ffff88", textColor: "#000" },
	backendProcessor: NoteProcessor,
});
