import { z } from "zod";

export const jsonPatchOpSchema = z.discriminatedUnion("op", [
	z.object({
		op: z.literal("add"),
		path: z.string(),
		value: z.any(),
	}),
	z.object({
		op: z.literal("remove"),
		path: z.string(),
	}),
	z.object({
		op: z.literal("replace"),
		path: z.string(),
		value: z.any(),
	}),
	z.object({
		op: z.literal("move"),
		from: z.string(),
		path: z.string(),
	}),
	z.object({
		op: z.literal("copy"),
		from: z.string(),
		path: z.string(),
	}),
	z.object({
		op: z.literal("test"),
		path: z.string(),
		value: z.any(),
	}),
]);

export const canvasPatchSchema = z.array(jsonPatchOpSchema);

export type JsonPatchOp = z.infer<typeof jsonPatchOpSchema>;
export type CanvasPatchPayload = z.infer<typeof canvasPatchSchema>;
