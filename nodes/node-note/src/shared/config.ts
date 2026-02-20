import { ColorSchema } from "@gatewai/node-sdk";
import { z } from "zod";

export const NoteNodeConfigSchema = z
	.object({
		content: z.string().optional(),
		backgroundColor: ColorSchema,
		textColor: ColorSchema,
		fontSize: z.number().optional(),
	})
	.strict();

export type NoteNodeConfig = z.infer<typeof NoteNodeConfigSchema>;
