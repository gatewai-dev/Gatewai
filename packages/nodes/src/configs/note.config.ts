import { z } from "zod";
import { ColorSchema } from "../common/schemas.js";

export const NoteNodeConfigSchema = z
	.object({
		text: z.string().optional(),
		backgroundColor: z.string().optional(),
		fontSize: z.number().optional(),
	})
	.strict();

export type NoteNodeConfig = z.infer<typeof NoteNodeConfigSchema>;
