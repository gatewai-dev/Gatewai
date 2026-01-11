import assert from "node:assert";
import { type APIResponse, RequestSchema } from "@gatewai/api-client";
import { prisma } from "@gatewai/db";
import type { TextNodeConfig } from "@gatewai/types";
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
		console.log({ batch });
		const result = await resolveBatchResult(batch.id);
		response.success = true;
		response.error = undefined;
		response.result = result;

		return c.json(response);
	})
	.post("/", zValidator("json", RequestSchema), async (c) => {
		const { canvasId, payload } = c.req.valid("json");
		assert(canvasId);
		const response: APIResponse = {};
		try {
			const duplicated = await duplicateCanvas(canvasId, true);

			// Starts processing but does not await*.
			// Frontend starts polling when it get's batch info response.
			if (payload) {
				for (const [nodeId, inputData] of Object.entries(payload)) {
					// Find the duplicated node using originla node id
					const node = await prisma.node.findFirstOrThrow({
						where: { originalNodeId: nodeId },
					});
					if (node.type === "Text") {
						await prisma.node.update({
							where: { id: node.id },
							data: {
								config: {
									content: inputData,
								} as TextNodeConfig,
							},
						});
					}
				}
			}

			// Run workflow for all nodes
			const wfProcessor = new NodeWFProcessor(prisma);
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
