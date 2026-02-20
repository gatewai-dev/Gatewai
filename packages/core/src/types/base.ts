import z from "zod";

export const DataTypes = [
	"Text",
	"Number",
	"Boolean",
	"Image",
	"Video",
	"Audio",
] as const;

/**
 * Zod schema for the FileAsset model
 * Matches the Prisma schema definitions for types and nullability.
 */
export const FileAssetSchema = z.object({
	id: z.string().cuid(),
	name: z.string(),
	createdAt: z.date().or(z.string().datetime()), // Handles both Date objects and ISO strings
	updatedAt: z.date().or(z.string().datetime()),

	width: z.number().int().nullable().optional(),
	height: z.number().int().nullable().optional(),

	bucket: z.string(),
	size: z.number().int(), // File size in bytes
	mimeType: z.string(),
	key: z.string(),

	signedUrl: z.string().url().nullable().optional(),
	signedUrlExp: z.date().or(z.string().datetime()).nullable().optional(),

	isUploaded: z.boolean().default(true),

	// Duration in milliseconds
	duration: z.number().int().nullable().optional(),

	// Metadata is defined as Json in Prisma
	metadata: z.record(z.any()).nullable().optional(),
	fps: z.number().int().nullable().optional(),
});

export type FileAsset = z.infer<typeof FileAssetSchema>;

export interface XYPosition {
	x: number;
	y: number;
}
