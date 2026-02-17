import { uploadToImportNode } from "@gatewai/media/server";
import { defineNode } from "@gatewai/node-sdk/server";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import metadata from "../metadata.js";
import { ImportProcessor } from "./processor.js";

const nodeRoute = new Hono();

const uploadSchema = z.object({
	file: z.any(),
});

nodeRoute.post(
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

export const fileNode = defineNode(metadata, {
	backendProcessor: ImportProcessor,
	route: nodeRoute,
});

export default fileNode;
