import z from "zod";

// File input types for structured file handling
export const FileInputSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("base64"),
		data: z.string(),
		mimeType: z.string().optional(),
	}),
	z.object({
		type: z.literal("url"),
		url: z.string().url(),
	}),
	z.object({
		type: z.literal("assetId"),
		assetId: z.string(),
	}),
]);

export type FileInput = z.infer<typeof FileInputSchema>;

// Union of simple string (text or legacy base64) and structured file input
export const NodeInputSchema = z.union([z.string(), FileInputSchema]);

export type NodeInput = z.infer<typeof NodeInputSchema>;

export const APIRunRequestSchema = z.object({
	canvasId: z.string(),
	payload: z.record(z.string(), NodeInputSchema).optional(),
	/** If true (default), duplicates the canvas before execution. Set to false to run on original canvas. */
	duplicate: z.boolean().default(true),
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
