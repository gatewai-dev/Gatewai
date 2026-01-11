import assert from "node:assert";
import { RequestSchema } from "@gatewai/api-client"; // Assuming shared lib
import { prisma } from "@gatewai/db";
import type { TextNodeConfig } from "@gatewai/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { duplicateCanvas } from "../../data-access/duplicate.js";
import { resolveBatchResult } from "../../data-access/resolve-batch-result.js";
import { NodeWFProcessor } from "../../tasks/canvas-workflow-processor.js";
import { assertIsError } from "../../utils/misc.js";

const apiRunRoutes = new Hono({ strict: false });

/**
 * GET /api/v1/api-run/:batchId/status
 */
apiRunRoutes.get("/:batchId/status", async (c) => {
	const batchId = c.req.param("batchId");

	const batch = await prisma.taskBatch.findFirstOrThrow({
		where: { id: batchId },
	});

	// If not finished, return early with handle
	if (!batch.finishedAt) {
		return c.json({
			batchHandleId: batch.id,
			success: true,
		});
	}

	try {
		const result = await resolveBatchResult(batch.id);
		return c.json({
			batchHandleId: batch.id,
			success: true,
			result,
		});
	} catch (error) {
		assertIsError(error);
		return c.json(
			{
				batchHandleId: batch.id,
				success: false,
				error: error.message,
			},
			500,
		);
	}
});

/**
 * POST /api/v1/api-run
 */
apiRunRoutes.post("/", zValidator("json", RequestSchema), async (c) => {
	const { canvasId, payload } = c.req.valid("json");

	try {
		assert(canvasId);
		// 1. Snapshot the canvas
		const duplicated = await duplicateCanvas(canvasId, true);

		// 2. Optimized Payload Processing (Bulk find instead of N+1)
		if (payload && Object.keys(payload).length > 0) {
			const originalNodeIds = Object.keys(payload);

			const nodes = await prisma.node.findMany({
				where: {
					canvasId: duplicated.id,
					originalNodeId: { in: originalNodeIds },
					type: "Text",
				},
			});

			// Update nodes in parallel
			await Promise.all(
				nodes.map((node) => {
					assert(node.originalNodeId);
					const inputData = payload[node.originalNodeId!];
					return prisma.node.update({
						where: { id: node.id },
						data: {
							config: { content: inputData } as TextNodeConfig,
						},
					});
				}),
			);
		}

		// 3. Trigger Workflow
		const wfProcessor = new NodeWFProcessor(prisma);
		const taskBatch = await wfProcessor.processNodes(duplicated.id);

		return c.json(
			{
				batchHandleId: taskBatch.id,
				success: true,
			},
			201,
		);
	} catch (error) {
		assertIsError(error);
		return c.json(
			{
				success: false,
				error: error.message,
				batchHandleId: "error", // Fallback for schema validation
			},
			500,
		);
	}
});

export { apiRunRoutes };
