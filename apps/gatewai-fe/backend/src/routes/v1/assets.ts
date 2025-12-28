import { prisma } from "@gatewai/db";
import type { FileResult } from "@gatewai/types";
import { zValidator } from "@hono/zod-validator";
import { randomUUID } from "crypto";
import { fileTypeFromBuffer } from "file-type";
import { Hono } from "hono";
import sharp from "sharp";
import { z } from "zod/v4";
import type { AuthHonoTypes } from "../../auth.js";
import {
	deleteFromS3,
	generateSignedUrl,
	getFromS3,
	uploadToS3,
} from "../../utils/s3.js";

const uploadSchema = z.object({
	file: z.any(),
});

const querySchema = z.object({
	pageSize: z.coerce.number().int().positive().max(100).default(10),
	pageIndex: z.coerce.number().int().nonnegative().default(0),
	q: z.string().default(""),
});

const assetsRouter = new Hono<{ Variables: AuthHonoTypes }>({
	strict: false,
})
	.get("/", zValidator("query", querySchema), async (c) => {
		const user = c.get("user");
		if (!user) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		const { pageSize, pageIndex, q } = c.req.valid("query");

		const skip = pageIndex * pageSize;
		const take = pageSize;

		const where = {
			userId: user.id,
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
		const user = c.get("user");
		if (!user) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		const form = await c.req.formData();
		const file = form.get("file");
		if (!(file instanceof File)) {
			return c.json({ error: "File is required" }, 400);
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const filename = file.name;
		const bucket = process.env.AWS_ASSETS_BUCKET ?? "default-bucket";
		const key = `assets/${user.id}/${randomUUID()}-${filename}`;

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
			await uploadToS3(buffer, key, contentType, bucket);

			const expiresIn = 3600 * 24 * 6.9; // A bit less than a week
			const signedUrl = await generateSignedUrl(key, bucket, expiresIn);
			const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

			const asset = await prisma.fileAsset.create({
				data: {
					name: filename,
					bucket,
					key,
					isUploaded: true,
					signedUrl,
					signedUrlExp,
					userId: user.id,
					width,
					height,
					mimeType: contentType, // Add mimeType to FileAsset model in Prisma schema
				},
			});

			return c.json(asset);
		} catch (error) {
			console.error(error);
			return c.json({ error: "Upload failed" }, 500);
		}
	})
	.post("/node/:nodeId", zValidator("form", uploadSchema), async (c) => {
		const user = c.get("user");
		if (!user) {
			return c.json({ error: "Unauthorized" }, 401);
		}

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

		if (!node || node.canvas.userId !== user.id) {
			return c.json({ error: "Node not found or unauthorized" }, 404);
		}

		const form = await c.req.formData();
		const file = form.get("file");
		if (!(file instanceof File)) {
			return c.json({ error: "File is required" }, 400);
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const filename = file.name;
		const bucket = process.env.AWS_ASSETS_BUCKET ?? "default-bucket";
		const key = `assets/${user.id}/${randomUUID()}-${filename}`;

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
			await uploadToS3(buffer, key, contentType, bucket);

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
					signedUrlExp,
					userId: user.id,
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

			let dataType: string;
			if (contentType.startsWith("image/")) {
				dataType = "Image";
			} else if (contentType.startsWith("video/")) {
				dataType = "Video";
			} else {
				dataType = "File";
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
	.get("/:id", zValidator("param", z.object({ id: z.string() })), async (c) => {
		const id = c.req.param("id");

		const asset = await prisma.fileAsset.findUnique({
			where: { id },
		});

		if (!asset) {
			return c.json({ error: "Asset not found" }, 404);
		}

		try {
			const buffer = await getFromS3(asset.key, asset.bucket);
			const headers = {
				"Content-Type": asset.mimeType,
				"Content-Disposition": `inline; filename="${asset.name}"`,
			};
			return c.body(buffer, { headers });
		} catch (error) {
			console.error("Failed to fetch asset from S3:", error);
			return c.json({ error: "Failed to fetch asset" }, 500);
		}
	})
	.delete(
		"/:id",
		zValidator("param", z.object({ id: z.string() })),
		async (c) => {
			const user = c.get("user");
			if (!user) {
				return c.json({ error: "Unauthorized" }, 401);
			}

			const id = c.req.param("id");

			const asset = await prisma.fileAsset.findUnique({
				where: { id },
			});

			if (!asset || asset.userId !== user.id) {
				return c.json({ error: "Asset not found" }, 404);
			}

			try {
				await deleteFromS3(asset.key, asset.bucket);
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
