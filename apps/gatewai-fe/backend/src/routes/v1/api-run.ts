import { type APIResponse, RequestSchema } from "@gatewai/api-client";
import { prisma } from "@gatewai/db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { duplicateCanvas } from "../../data-access/duplicate.js";
import { resolveBatchResult } from "../../data-access/resolve-batch-result.js";
import { NodeWFProcessor } from "../../tasks/canvas-workflow-processor.js";
import { assertIsError } from "../../utils/misc.js";

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
		response.success = true;
		response.error = undefined;
		response.result = result;

		return c.json({
			response,
		});
	})
	.post("/:id", zValidator("json", RequestSchema), async (c) => {
		const canvasId = c.req.param("id");

		const response: APIResponse = {};
		try {
			const duplicated = await duplicateCanvas(canvasId);

			const wfProcessor = new NodeWFProcessor(prisma);

			// Starts processing but does not await*.
			// Frontend starts polling when it get's batch info response.
			const taskBatch = await wfProcessor.processNodes(duplicated.id);
			response.batchHandleId = taskBatch.id;
		} catch (error) {
			assertIsError(error);
			response.success = false;
			response.error = error.message;
			response.result = undefined;
		}

		return c.json(response, 201);
	});

export { apiRunRoutes };
