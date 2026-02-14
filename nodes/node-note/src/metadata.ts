import { defineMetadata } from "@gatewai/node-sdk";
import { z } from "zod";

const ColorSchema = z.string().regex(/^#([0-9a-fA-F]{3,8})$/);

export const NoteNodeConfigSchema = z
	.object({
		text: z.string().optional(),
		backgroundColor: ColorSchema,
		fontSize: z.number().optional(),
	})
	.strict();

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
