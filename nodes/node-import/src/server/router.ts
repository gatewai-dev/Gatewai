import { uploadToImportNode } from "@gatewai/media/server";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

const uploadSchema = z.object({
	file: z.any(),
});

const importNodeRouter = new Hono().post(
	"/upload/:nodeId",
	zValidator("form", uploadSchema),
	async (c) => {
		const { nodeId } = c.req.param();
		const body = await c.req.parseBody();
		const file = body.file;

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
			console.error(error);
			return c.json({ error: "Upload failed" }, 500);
		}
	},
);

export { importNodeRouter };
