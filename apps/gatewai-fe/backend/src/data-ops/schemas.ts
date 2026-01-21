import z from "zod";

export const APIRunRequestSchema = z.object({
	canvasId: z.string(),
	payload: z.record(z.string(), z.string()).optional(),
});

export type APIRunRequest = z.infer<typeof APIRunRequestSchema>;

export const APIRunResultValueSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("Video"), data: z.string() }),
	z.object({ type: z.literal("Audio"), data: z.string() }),
	z.object({ type: z.literal("Text"), data: z.string() }),
	z.object({ type: z.literal("Image"), data: z.string() }),
	z.object({ type: z.literal("Number"), data: z.number() }),
	z.object({ type: z.literal("Boolean"), data: z.boolean() }),
]);

export const APIRunResponseSchema = z.object({
	batchHandleId: z.string(),
	result: z.record(z.string(), APIRunResultValueSchema).optional(),
	success: z.boolean().default(true),
	error: z.string().optional(),
});
export type APIRunResponse = z.infer<typeof APIRunResponseSchema>;
