import {
	type APIResponse,
	RequestSchema,
	ResponseSchema,
} from "@gatewai/api-client";
import { prisma } from "@gatewai/db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { duplicateCanvas } from "../../data-access/duplicate.js";
import { NodeWFProcessor } from "../../tasks/canvas-workflow-processor.js";

const apiRunRoutes = new Hono({
	strict: false,
})
	.get("/:batchId/status", async (c) => {
		const batchId = c.req.param("batchId");

		const batch = await prisma.taskBatch.findFirstOrThrow({
			where: {
				id: batchId,
			},
		});

		const response: APIResponse = {
			batchHandleId: batch.id,
		};

		if (!batch.finishedAt) {
			return c.json(response);
		}

		const result = await resolveBatchResult(batch.id);

		return c.json({
			response,
		});
	})
	.post("/:id", zValidator("json", RequestSchema), async (c) => {
		const canvasId = c.req.param("id");
		const validated = c.req.valid("json");

		const duplicated = await duplicateCanvas(canvasId);

		const wfProcessor = new NodeWFProcessor(prisma);

		// Starts processing but does not await*.
		// Frontend starts polling when it get's batch info response.
		const taskBatch = await wfProcessor.processNodes(canvasId);

		return c.json(taskBatch, 201);
	});

export { apiRunRoutes };
