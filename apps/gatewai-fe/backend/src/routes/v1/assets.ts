import assert from "node:assert";
import { logger } from "@gatewai/core";
import { type FileAssetWhereInput, prisma } from "@gatewai/db";
import type { NodeResult, Output, OutputItem } from "@gatewai/types";
import { zValidator } from "@hono/zod-validator";
import { fileTypeFromBuffer } from "file-type";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthorizedHonoTypes } from "../../auth.js";
import { ENV_CONFIG } from "@gatewai/core";
import { uploadToImportNode } from "../../node-fns/import-media.js";
import {
	generateImageThumbnail,
	generateVideoThumbnail,
} from "@gatewai/media"; // Exported as utils
import { assertIsError } from "../../utils/misc.js";
import { generateId } from "@gatewai/core";
import { container } from "@gatewai/di";
import { TOKENS } from "@gatewai/node-sdk";
import type { StorageService, MediaService } from "@gatewai/types";
import { assertAssetOwnership } from "./auth-helpers.js";

const uploadSchema = z.object({
	file: z.any(),
});

const uploadFromUrlSchema = z.object({
	url: z.string().url("Must be a valid URL"),
	filename: z.string().optional(),
});

const querySchema = z.object({
	pageSize: z.coerce.number().int().positive().max(1000).default(1000),
	pageIndex: z.coerce.number().int().nonnegative().default(0),
	q: z.string().default(""),
	type: z.enum(["image", "video", "audio"]).optional(),
});

/**
 * Download file from URL and return buffer
 */
async function downloadFileFromUrl(url: string): Promise<{
	buffer: Buffer;
	filename: string;
	contentType: string;
}> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to download file: ${response.statusText}`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());

	// Try to extract filename from URL or Content-Disposition header
	let filename = "downloaded-file";
	const contentDisposition = response.headers.get("content-disposition");

	if (contentDisposition) {
		const filenameMatch = contentDisposition.match(
			/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
		);
		if (filenameMatch?.[1]) {
			filename = filenameMatch[1].replace(/['"]/g, "");
		}
	} else {
		// Extract from URL
		const urlPath = new URL(url).pathname;
		const urlFilename = urlPath.split("/").pop();
		if (urlFilename?.includes(".")) {
			filename = urlFilename;
		}
	}

	// Get content type from response or detect from buffer
	let contentType =
		response.headers.get("content-type") || "application/octet-stream";

	// Verify content type by detecting from buffer
	const fileTypeResult = await fileTypeFromBuffer(buffer);
	if (fileTypeResult?.mime) {
		contentType = fileTypeResult.mime;

		// If filename doesn't have proper extension, add it
		const hasExtension = filename.includes(".");
		if (!hasExtension && fileTypeResult.ext) {
			filename = `${filename}.${fileTypeResult.ext}`;
		}
	}

	return { buffer, filename, contentType };
}

const assetsRouter = new Hono<{ Variables: AuthorizedHonoTypes }>({
	strict: false,
})
	.get("/", zValidator("query", querySchema), async (c) => {
		const user = c.get("user");
		const { pageSize, pageIndex, q, type } = c.req.valid("query");

		const skip = pageIndex * pageSize;
		const take = pageSize;

		const where: FileAssetWhereInput = {
			userId: user.id,
			name: {
				contains: q,
				mode: "insensitive",
			},
		};

		if (type) {
			where.mimeType = {
				startsWith: `${type}/`,
			};
		}

		const [assets, total] = await Promise.all([
			prisma.fileAsset.findMany({
				where,
				skip,
				take,
				orderBy: { createdAt: "desc" },
			}),
			prisma.fileAsset.count({ where }),
		]);

		return c.json({
			assets,
			total,
			pageSize,
			pageIndex,
		});
	})
	.post("/", zValidator("form", uploadSchema), async (c) => {
		const user = c.get("user");
		const form = await c.req.formData();
		const file = form.get("file");
		if (!(file instanceof File)) {
			return c.json({ error: "File is required" }, 400);
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const fileSize = buffer.length;
		const filename = file.name;
		const bucket = process.env.AWS_ASSETS_BUCKET ?? "default-bucket";
		const key = `assets/${generateId()}-${filename}`;

		// Detect MIME type from buffer using file-type
		const fileTypeResult = await fileTypeFromBuffer(buffer);
		const contentType =
			fileTypeResult?.mime ?? file.type ?? "application/octet-stream";

		let width: number | null = null;
		let height: number | null = null;

		if (contentType.startsWith("image/")) {
			try {
				const media = container.resolve<MediaService>(TOKENS.MEDIA);
				const metadata = await media.getImageDimensions(buffer);
				width = metadata.width || null;
				height = metadata.height || null;
			} catch (error) {
				console.error("Failed to compute image metadata:", error);
			}
		}

		try {
			const storage = container.resolve<StorageService>(TOKENS.STORAGE);
			await storage.uploadToGCS(buffer, key, contentType, bucket);

			const expiresIn = 3600 * 24 * 6.9; // A bit less than a week
			const signedUrl = await storage.generateSignedUrl(key, bucket, expiresIn);
			const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

			const asset = await prisma.fileAsset.create({
				data: {
					name: filename,
					userId: user.id,
					bucket,
					key,
					isUploaded: true,
					size: fileSize,
					signedUrl,
					signedUrlExp,
					width,
					height,
					mimeType: contentType,
				},
			});

			return c.json(asset);
		} catch (error) {
			console.error(error);
			return c.json({ error: "Upload failed" }, 500);
		}
	})
	.post("/from-url", zValidator("json", uploadFromUrlSchema), async (c) => {
		const user = c.get("user");
		const { url, filename: customFilename } = c.req.valid("json");

		try {
			// Download file from URL
			const {
				buffer,
				filename: downloadedFilename,
				contentType,
			} = await downloadFileFromUrl(url);

			const fileSize = buffer.length;
			const filename = customFilename || downloadedFilename;
			const bucket = process.env.AWS_ASSETS_BUCKET ?? "default-bucket";
			const key = `assets/${generateId()}-${filename}`;

			let width: number | null = null;
			let height: number | null = null;

			// Extract image dimensions if it's an image
			if (contentType.startsWith("image/")) {
				try {
					const media = container.resolve<MediaService>(TOKENS.MEDIA);
					const metadata = await media.getImageDimensions(buffer);
					width = metadata.width || null;
					height = metadata.height || null;
				} catch (error) {
					assertIsError(error);
					logger.error(`Failed to compute image metadata: ${error.message}`);
				}
			}

			// Upload to storage
			const storage = container.resolve<StorageService>(TOKENS.STORAGE);
			await storage.uploadToGCS(buffer, key, contentType, bucket);

			const expiresIn = 3600 * 24 * 6.9; // A bit less than a week
			const signedUrl = await storage.generateSignedUrl(key, bucket, expiresIn);
			const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

			// Create asset record in database
			const asset = await prisma.fileAsset.create({
				data: {
					name: filename,
					userId: user.id,
					bucket,
					key,
					isUploaded: true,
					size: fileSize,
					signedUrl,
					signedUrlExp,
					width,
					height,
					mimeType: contentType,
				},
			});

			return c.json(asset);
		} catch (error) {
			assertIsError(error);
			logger.error(`Upload from URL failed: ${error.message}`);
			return c.json(
				{
					error: "Upload from URL failed",
					details: error.message,
				},
				500,
			);
		}
	})
	.post("/node/:nodeId", zValidator("form", uploadSchema), async (c) => {
		const { nodeId } = c.req.param();
		const body = await c.req.parseBody();
		const file = body.file;

		// Validation: Check if it's strictly a File object (as expected from form-data)
		if (!(file instanceof File)) {
			return c.json({ error: "File is required" }, 400);
		}

		try {
			const buffer = Buffer.from(await file.arrayBuffer());
			const updatedNode = await uploadToImportNode({
				nodeId,
				buffer,
				filename: file.name,
				mimeType: file.type || undefined,
			});

			return c.json(updatedNode);
		} catch (error) {
			assertIsError(error);
			logger.error(`Node asset upload failed: ${error.message}`);
			// Return 404 if node missing, otherwise 500
			if (error.message.includes("not found")) {
				return c.json({ error: error.message }, 404);
			}
			return c.json({ error: "Upload failed" }, 500);
		}
	})
	.get(
		"/thumbnail/:id",
		zValidator(
			"query",
			z.object({
				w: z.coerce.number().int().positive().default(50),
				h: z.coerce.number().int().positive().default(50),
			}),
		),
		async (c) => {
			const { id: rawId } = c.req.param();
			const { w: width, h: height } = c.req.valid("query");
			const id = rawId.split(".")[0]; // Sanitize ID

			// 1. Construct Cache Key
			const cacheBucket = ENV_CONFIG.GCS_ASSETS_BUCKET;
			const cacheKey = `temp/thumbnails/${id}_${width}_${height}.webp`;

			try {
				const storage = container.resolve<StorageService>(TOKENS.STORAGE);
				// 2. Check Cache
				const exists = await storage.fileExistsInGCS(cacheKey, cacheBucket);
				if (exists) {
					const stream = storage.getStreamFromGCS(cacheKey, cacheBucket);
					return c.body(stream, 200, {
						"Content-Type": "image/webp",
						"Access-Control-Allow-Origin": "*",
						"Cache-Control": "public, max-age=31536000, immutable",
					});
				}

				// 3. Cache Miss: Retrieve Original Asset
				const asset = await prisma.fileAsset.findUnique({ where: { id } });
				if (!asset) {
					return c.json({ error: "Asset not found" }, 404);
				}

				let thumbnailBuffer: Buffer;

				// 4. Generate Thumbnail based on Type
				if (asset.mimeType.startsWith("video/")) {
					// For videos, we need a Signed URL to pass to ffmpeg (remote read)
					// This avoids downloading the entire video file to memory
					const sourceUrl = await storage.generateSignedUrl(
						asset.key,
						asset.bucket,
						300, // 5 minutes validity
					);
					thumbnailBuffer = await generateVideoThumbnail(
						sourceUrl,
						width,
						height,
					);
				} else if (asset.mimeType.startsWith("image/")) {
					// For images, we download the buffer to process with Sharp
					const originalBuffer = await storage.getFromGCS(asset.key, asset.bucket);
					thumbnailBuffer = await generateImageThumbnail(
						originalBuffer,
						width,
						height,
					);
				} else {
					return c.json({ error: "Unsupported asset type for thumbnail" }, 400);
				}

				// 5. Upload to Cache
				await storage.uploadToGCS(thumbnailBuffer, cacheKey, "image/webp", cacheBucket);

				// 6. Return Response
				return c.body(thumbnailBuffer, 200, {
					"Content-Type": "image/webp",
					"Access-Control-Allow-Origin": "*",
					"Cache-Control": "public, max-age=31536000, immutable",
				});
			} catch (error) {
				logger.error(`Thumbnail generation failed for ${id}: ${error}`);
				assertIsError(error);
				return c.json(
					{ error: "Thumbnail generation failed", details: error.message },
					500,
				);
			}
		},
	)
	.get("/temp/*", async (c) => {
		const path = c.req.path.split("/temp/")[1];
		const rawKey = decodeURIComponent(path);
		const storage = container.resolve<StorageService>(TOKENS.STORAGE);

		assert(rawKey);
		const fullStream = await storage.getFromGCS(rawKey);
		const metadata = await storage.getObjectMetadata(rawKey);
		assert(metadata.contentType);

		return c.body(fullStream as any, { // Cast buffer to any/stream compatible
			headers: {
				"Content-Type": metadata.contentType,
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "max-age=2592000",
			},
		});
	})
	.get("/:id", async (c) => {
		const rawId = c.req.param("id");
		const id = rawId.split(".")[0];
		const asset = await prisma.fileAsset.findUnique({ where: { id } });

		if (!asset) return c.json({ error: "Not found" }, 404);

		const storage = container.resolve<StorageService>(TOKENS.STORAGE);

		const range = c.req.header("Range");
		const fileSize = Number(asset.size);

		if (range) {
			const parts = range.replace(/bytes=/, "").split("-");
			const start = parseInt(parts[0], 10);
			const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

			// Handle potential NaN or out-of-bounds
			if (start >= fileSize || end >= fileSize) {
				return c.text("Requested range not satisfiable", 416, {
					"Content-Range": `bytes */${fileSize}`,
				});
			}

			const chunksize = end - start + 1;
			const stream = storage.getStreamFromGCS(asset.key, asset.bucket, { start, end });

			return c.body(stream, 206, {
				"Content-Range": `bytes ${start}-${end}/${fileSize}`,
				"Accept-Ranges": "bytes",
				"Content-Length": chunksize.toString(),
				"Content-Type": asset.mimeType,
				"Access-Control-Allow-Origin": "*",
			});
		}

		// Full file stream
		const fullStream = storage.getStreamFromGCS(asset.key, asset.bucket);
		return c.body(fullStream, {
			headers: {
				"Content-Type": asset.mimeType,
				"Access-Control-Allow-Origin": "*",
				"Accept-Ranges": "bytes",
				"Content-Length": fileSize.toString(),
				"Cache-Control": "max-age=2592000",
			},
		});
	})
	.delete(
		"/:id",
		zValidator("param", z.object({ id: z.string() })),
		async (c) => {
			const rawId = c.req.param("id");
			const id = rawId.split(".")[0]; // Sanitize ID

			// Validate user owns this asset
			const asset = await assertAssetOwnership(c as any, id);

			logger.info(`Deleting asset ${id} (key: ${asset.key})`);

			try {
				// 1. Find all nodes that reference this asset in their result
				// We use a raw query because Prisma's JSON filtering is limited for deep searches
				const nodes = await prisma.$queryRaw<{ id: string; result: any }[]>`
					SELECT id, result 
					FROM "node" 
					WHERE result::text LIKE ${`%${id}%`}
				`;
				logger.info(`Found ${nodes.length} nodes referencing asset ${id}`);

				// 2. Update each node to remove the asset reference
				for (const node of nodes) {
					// Handle potential stringified JSON from raw query
					let result: NodeResult;
					if (typeof node.result === "string") {
						try {
							result = JSON.parse(node.result);
						} catch (e) {
							logger.error(
								{ err: e },
								`Failed to parse result for node ${node.id}`,
							);
							continue;
						}
					} else {
						result = node.result;
					}

					if (!result) continue;

					let hasChanges = false;

					// Traverse outputs to find and remove the asset
					// Note: selectedOutputIndex refers to the index in the outputs array
					if (result.outputs && Array.isArray(result.outputs)) {
						const currentSelectedIndex = result.selectedOutputIndex ?? 0;

						// First pass: filter items within each output
						result.outputs.forEach((output: Output, outputIndex: number) => {
							if (output.items && Array.isArray(output.items)) {
								// Filter out items containing the asset
								output.items = output.items.filter((item: OutputItem<any>) => {
									// Only check entity.id for object data (FileData), not primitives
									const data = item.data;
									const entityId =
										typeof data === "object" &&
											data !== null &&
											"entity" in data
											? (data as { entity?: { id?: string } }).entity?.id
											: undefined;
									const matches = entityId === id;
									if (matches) {
										hasChanges = true;
									}
									return !matches;
								});
							}
						});

						// Second pass: Remove outputs that have become empty
						const removedOutputIndices: number[] = [];

						result.outputs = result.outputs.filter(
							(output: Output, outputIndex: number) => {
								const isEmpty = !output.items || output.items.length === 0;
								if (isEmpty) {
									removedOutputIndices.push(outputIndex);
									hasChanges = true;
								}
								return !isEmpty;
							},
						);

						// Adjust selectedOutputIndex if outputs were removed
						if (removedOutputIndices.length > 0) {
							const newOutputsLength = result.outputs.length;

							if (newOutputsLength === 0) {
								// All outputs removed, reset to 0
								result.selectedOutputIndex = 0;
							} else if (removedOutputIndices.includes(currentSelectedIndex)) {
								// The selected output was removed, select the last available
								result.selectedOutputIndex = Math.max(0, newOutputsLength - 1);
							} else {
								// Count how many outputs before the selected one were removed
								const removedBefore = removedOutputIndices.filter(
									(idx) => idx < currentSelectedIndex,
								).length;

								// Shift the index
								let newIndex = currentSelectedIndex - removedBefore;

								// Clamp to valid range
								if (newIndex >= newOutputsLength) {
									newIndex = newOutputsLength - 1;
								} else if (newIndex < 0) {
									newIndex = 0;
								}

								result.selectedOutputIndex = newIndex;
							}
						}
					}

					if (hasChanges) {
						await prisma.node.update({
							where: { id: node.id },
							data: { result: result as any }, // Cast to any to satisfy Prisma InputJsonValue
						});
						logger.info(`Updated node ${node.id} to remove asset reference`);
					}
				}

				// 3. Delete from Storage and DB
				try {
					const storage = container.resolve<StorageService>(TOKENS.STORAGE);
					await storage.deleteFromGCS(asset.key, asset.bucket);
					logger.info(`Deleted from GCS: ${asset.key}`);
				} catch (err) {
					logger.error({ err }, `Failed to delete from GCS: ${asset.key}`);
					// Continue to delete from DB even if GCS failed (orphan check later?)
				}

				await prisma.fileAsset.delete({
					where: { id },
				});
				logger.info(`Deleted asset record ${id}`);

				return c.json({ success: true });
			} catch (error) {
				logger.error({ err: error }, `Asset deletion failed for ${id}`);
				return c.json({ error: "Deletion failed" }, 500);
			}
		},
	);

export { assetsRouter };
