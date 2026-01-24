import assert from "node:assert";
import { type FileAssetWhereInput, prisma } from "@gatewai/db";
import { zValidator } from "@hono/zod-validator";
import { fileTypeFromBuffer } from "file-type";
import { Hono } from "hono";
import sharp from "sharp";
import { z } from "zod";
import {
	type AuthHonoTypes,
	type AuthorizedHonoTypes,
	authMiddleware,
} from "../../auth.js";
import { ENV_CONFIG } from "../../config.js";
import { logger } from "../../logger.js";
import { uploadToImportNode } from "../../node-fns/import-media.js";
import {
	generateImageThumbnail,
	generateVideoThumbnail,
} from "../../utils/media.js";
import { assertIsError, generateId } from "../../utils/misc.js";
import {
	deleteFromGCS,
	fileExistsInGCS,
	generateSignedUrl,
	getFromGCS,
	getObjectMetadata,
	getStreamFromGCS,
	uploadToGCS,
} from "../../utils/storage.js";

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
		const { pageSize, pageIndex, q, type } = c.req.valid("query");

		const skip = pageIndex * pageSize;
		const take = pageSize;

		const where: FileAssetWhereInput = {
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
				const metadata = await sharp(buffer).metadata();
				width = metadata.width ?? null;
				height = metadata.height ?? null;
			} catch (error) {
				console.error("Failed to compute image metadata:", error);
			}
		}

		try {
			await uploadToGCS(buffer, key, contentType, bucket);

			const expiresIn = 3600 * 24 * 6.9; // A bit less than a week
			const signedUrl = await generateSignedUrl(key, bucket, expiresIn);
			const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

			const asset = await prisma.fileAsset.create({
				data: {
					name: filename,
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
					const metadata = await sharp(buffer).metadata();
					width = metadata.width ?? null;
					height = metadata.height ?? null;
				} catch (error) {
					assertIsError(error);
					logger.error(`Failed to compute image metadata: ${error.message}`);
				}
			}

			// Upload to storage
			await uploadToGCS(buffer, key, contentType, bucket);

			const expiresIn = 3600 * 24 * 6.9; // A bit less than a week
			const signedUrl = await generateSignedUrl(key, bucket, expiresIn);
			const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

			// Create asset record in database
			const asset = await prisma.fileAsset.create({
				data: {
					name: filename,
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
			console.log({ nodeId });
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
				w: z.coerce.number().int().positive().default(300),
				h: z.coerce.number().int().positive().default(300),
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
				// 2. Check Cache
				const exists = await fileExistsInGCS(cacheKey, cacheBucket);
				if (exists) {
					const stream = getStreamFromGCS(cacheKey, cacheBucket);
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
					const sourceUrl = await generateSignedUrl(
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
					const originalBuffer = await getFromGCS(asset.key, asset.bucket);
					thumbnailBuffer = await generateImageThumbnail(
						originalBuffer,
						width,
						height,
					);
				} else {
					return c.json({ error: "Unsupported asset type for thumbnail" }, 400);
				}

				// 5. Upload to Cache
				await uploadToGCS(thumbnailBuffer, cacheKey, "image/webp", cacheBucket);

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

		assert(rawKey);
		const fullStream = await getFromGCS(rawKey);
		const metadata = await getObjectMetadata(rawKey);
		assert(metadata.contentType);

		return c.body(fullStream, {
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
			const stream = getStreamFromGCS(asset.key, asset.bucket, { start, end });

			return c.body(stream, 206, {
				"Content-Range": `bytes ${start}-${end}/${fileSize}`,
				"Accept-Ranges": "bytes",
				"Content-Length": chunksize.toString(),
				"Content-Type": asset.mimeType,
				"Access-Control-Allow-Origin": "*",
			});
		}

		// Full file stream
		const fullStream = getStreamFromGCS(asset.key, asset.bucket);
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
			const id = c.req.param("id");

			const asset = await prisma.fileAsset.findUnique({
				where: { id },
			});

			if (!asset) {
				return c.json({ error: "Asset not found" }, 404);
			}

			try {
				await deleteFromGCS(asset.key, asset.bucket);
				await prisma.fileAsset.delete({
					where: { id },
				});
				return c.json({ success: true });
			} catch (error) {
				console.error(error);
				return c.json({ error: "Deletion failed" }, 500);
			}
		},
	);

export { assetsRouter };
