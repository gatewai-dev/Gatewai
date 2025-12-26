import { Hono } from "hono";
import { prisma } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod/v4";
import { randomUUID } from "crypto";
import { deleteFromS3, generateSignedUrl, uploadToS3, getFromS3 } from "../../utils/s3.js";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";

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
.get(
  "/",
  zValidator("query", querySchema),
  async (c) => {
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
  }
)
.post(
  "/",
  zValidator("form", uploadSchema),
  async (c) => {
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
    const contentType = fileTypeResult?.mime ?? file.type ?? 'application/octet-stream'; 

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
  }
)
.get(
  "/:id",
  zValidator("param", z.object({ id: z.string() })),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");

    const asset = await prisma.fileAsset.findUnique({
      where: { id, userId: user.id },
    });

    if (!asset) {
      return c.json({ error: "Asset not found" }, 404);
    }

    try {
      const buffer = await getFromS3(asset.key, asset.bucket);
      const headers = {
        'Content-Type': asset.mimeType,
        'Content-Disposition': `inline; filename="${asset.name}"`,
      };
      return c.body(buffer, { headers });
    } catch (error) {
      console.error("Failed to fetch asset from S3:", error);
      return c.json({ error: "Failed to fetch asset" }, 500);
    }
  }
)
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
  }
);

export { assetsRouter };