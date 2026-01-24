import assert from "node:assert";
import { prisma } from "@gatewai/db";
import type { TextNodeConfig } from "@gatewai/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { duplicateCanvas } from "../../data-ops/duplicate-canvas.js";
import { resolveBatchResult } from "../../data-ops/resolve-batch-result.js";
import {
	APIRunRequestSchema,
	APIRunResponseSchema,
} from "../../data-ops/schemas.js";
import { NodeWFProcessor } from "../../graph-engine/canvas-workflow-processor.js";
import { uploadToImportNode } from "../../node-fns/import-media.js";
import { assertIsError, generateId } from "../../utils/misc.js";

const apiRunRoutes = new Hono({ strict: false })
	/**
	 * GET /api/v1/api-run/:batchId/status
	 */
	.get("/:batchId/status", async (c) => {
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
				error: null,
				result,
			});
		} catch (error) {
			assertIsError(error);
			return c.json(
				{
					batchHandleId: batch.id,
					success: false,
					error: error.message,
					result: undefined,
				},
				500,
			);
		}
	})
	/**
	 * POST /api/v1/api-run
	 */
	.post("/", zValidator("json", APIRunRequestSchema), async (c) => {
		const { canvasId, payload } = c.req.valid("json");

		try {
			assert(canvasId);
			// Duplicate the canvas
			const duplicated = await duplicateCanvas(canvasId, true);

			// Optimized Payload Processing
			if (payload && Object.keys(payload).length > 0) {
				const originalNodeIds = Object.keys(payload);

				// Fetch both Text and File nodes that match the payload keys
				const nodes = await prisma.node.findMany({
					where: {
						canvasId: duplicated.id,
						originalNodeId: { in: originalNodeIds },
						type: { in: ["Text", "File"] },
					},
				});

				// Update nodes in parallel
				await Promise.all(
					nodes.map(async (node) => {
						assert(node.originalNodeId);
						const inputData = payload[node.originalNodeId];

						if (node.type === "Text") {
							return prisma.node.update({
								where: { id: node.id },
								data: {
									config: { content: inputData } as TextNodeConfig,
								},
							});
						}

						if (node.type === "File") {
							// Handle Base64 Upload
							// Strip 'data:image/xyz;base64,' prefix if present to get pure base64
							const base64Data = inputData.includes("base64,")
								? inputData.split("base64,")[1]
								: inputData;

							const buffer = Buffer.from(base64Data, "base64");

							// Generate a filename since base64 payloads don't usually carry it
							// We can rely on detection inside uploadToImportNode to set the extension later,
							// or we can pass a generic name.
							const filename = `api-upload-${generateId()}`;

							await uploadToImportNode({
								nodeId: node.id,
								buffer,
								filename,
							});
						}
					}),
				);
			}

			// 3. Trigger Workflow
			const wfProcessor = new NodeWFProcessor(prisma);
			const taskBatch = await wfProcessor.processNodes(duplicated.id);
			const result = APIRunResponseSchema.parse({
				batchHandleId: taskBatch.id,
				success: true,
				error: undefined,
				result: undefined,
			});
			return c.json(result, 201);
		} catch (error) {
			assertIsError(error);
			const result = APIRunResponseSchema.parse({
				success: false,
				error: error.message,
				batchHandleId: "error",
				result: undefined,
			});
			return c.json(result, 500);
		}
	});

export { apiRunRoutes };
