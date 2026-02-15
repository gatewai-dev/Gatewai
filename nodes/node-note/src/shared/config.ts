import { ColorSchema } from "@gatewai/node-sdk";
import { z } from "zod";

export const NoteNodeConfigSchema = z
	.object({
		text: z.string().optional(),
		backgroundColor: ColorSchema,
		fontSize: z.number().optional(),
	})
	.strict();

export type NoteNodeConfig = z.infer<typeof NoteNodeConfigSchema>;
