import { randomUUID } from "node:crypto";
import { type DataType, prisma } from "@gatewai/db";
import type { FileResult } from "@gatewai/types";
import { zValidator } from "@hono/zod-validator";
import { fileTypeFromBuffer } from "file-type";
import { Hono } from "hono";
import * as mm from "music-metadata";
import sharp from "sharp";
import { z } from "zod";
import { ENV_CONFIG } from "../../config.js";
import {
	deleteFromGCS,
	generateSignedUrl,
	getStreamFromGCS,
	uploadToGCS,
} from "../../utils/storage.js";

const uploadSchema = z.object({
	file: z.any(),
});

const querySchema = z.object({
	pageSize: z.coerce.number().int().positive().max(100).default(10),
	pageIndex: z.coerce.number().int().nonnegative().default(0),
	q: z.string().default(""),
});

const assetsRouter = new Hono({
	strict: false,
})
	.get("/", zValidator("query", querySchema), async (c) => {
		const { pageSize, pageIndex, q } = c.req.valid("query");

		const skip = pageIndex * pageSize;
		const take = pageSize;

		const where = {
			name: {
				contains: q,
			},
		} as const;

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
		const key = `assets/${randomUUID()}-${filename}`;

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
	.post("/node/:nodeId", zValidator("form", uploadSchema), async (c) => {
		const { nodeId } = c.req.param();

		const node = await prisma.node.findUnique({
			where: { id: nodeId },
			include: {
				canvas: true,
				handles: {
					where: { type: "Output" },
					orderBy: { order: "asc" },
				},
			},
		});

		if (!node) {
			return c.json({ error: "Node not found" }, 404);
		}

		const body = await c.req.parseBody();
		const file = body.file as File;
		console.log({ file }, file instanceof File);
		// Dafuq happened and this started throw error ?
		// if (!(file instanceof File)) {
		// 	console.log('defuq')
		// 	return c.json({ error: "File is required" }, 400);
		// }

		const buffer = Buffer.from(await file.arrayBuffer());
		const fileSize = buffer.length;
		const filename = file.name;
		const bucket = ENV_CONFIG.GCS_ASSETS_BUCKET;
		const key = `assets/${randomUUID()}-${filename}`;

		const fileTypeResult = await fileTypeFromBuffer(buffer);
		const contentType =
			fileTypeResult?.mime ?? file.type ?? "application/octet-stream";

		let width: number | null = null;
		let height: number | null = null;
		let durationInSec: number | null = null; // Add this variable

		if (contentType.startsWith("image/")) {
			try {
				const metadata = await sharp(buffer).metadata();
				width = metadata.width ?? null;
				height = metadata.height ?? null;
			} catch (error) {
				console.error("Failed to compute image metadata:", error);
			}
		}
		if (contentType.startsWith("video/") || contentType.startsWith("audio/")) {
			try {
				const metadata = await mm.parseBuffer(buffer, {
					mimeType: contentType,
				});
				durationInSec = metadata.format.duration ?? null;
			} catch (error) {
				console.error("Failed to compute media duration:", error);
			}
		}
		console.log({ durationInSec, contentType, height, width });

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
					signedUrl,
					isUploaded: true,
					duration: durationInSec
						? Math.round(durationInSec * 1000)
						: undefined,
					size: fileSize,
					signedUrlExp,
					width,
					height,
					mimeType: contentType,
				},
			});

			// Update node result
			const currentResult = (node.result as unknown as FileResult) || {
				outputs: [],
			};
			const outputs = currentResult.outputs || [];
			const newIndex = outputs.length;

			const outputHandle = node.handles[0];
			if (!outputHandle) {
				throw new Error("No output handle found for node");
			}

			let dataType: DataType;
			if (contentType.startsWith("image/")) {
				dataType = "Image";
			} else if (contentType.startsWith("video/")) {
				dataType = "Video";
			} else if (contentType.startsWith("audio/")) {
				dataType = "Audio";
			} else {
				throw new Error(`Invalid content type: ${contentType}`);
			}

			const newOutput = {
				items: [
					{
						outputHandleId: outputHandle.id,
						data: {
							entity: asset,
						},
						type: dataType,
					},
				],
			};

			const updatedResult = {
				...currentResult,
				selectedOutputIndex: newIndex,
				outputs: [...outputs, newOutput],
			};

			const updatedNode = await prisma.node.update({
				where: { id: nodeId },
				data: { result: updatedResult },
				include: {
					handles: true,
				},
			});

			return c.json(updatedNode);
		} catch (error) {
			console.error("Node asset upload failed:", error);
			return c.json({ error: "Upload failed" }, 500);
		}
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
			});
		}

		// Full file stream
		const fullStream = getStreamFromGCS(asset.key, asset.bucket);
		return c.body(fullStream, {
			headers: {
				"Content-Type": asset.mimeType,
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
