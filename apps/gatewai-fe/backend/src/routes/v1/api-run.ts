import assert from "node:assert";
import { prisma } from "@gatewai/db";
import type { TextNodeConfig } from "@gatewai/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AuthorizedHonoTypes } from "../../auth.js";
import { duplicateCanvas } from "../../data-ops/duplicate-canvas.js";
import { resolveBatchResult } from "../../data-ops/resolve-batch-result.js";
import {
	APIRunRequestSchema,
	APIRunResponseSchema,
	type NodeInput,
} from "../../data-ops/schemas.js";
import { NodeWFProcessor } from "../../graph-engine/canvas-workflow-processor.js";
import { uploadToImportNode } from "../../node-fns/import-media.js";
import { assertIsError, generateId } from "../../utils/misc.js";
import { assertCanvasOwnership } from "./auth-helpers.js";

const apiRunRoutes = new Hono<{ Variables: AuthorizedHonoTypes }>({
	strict: false,
})
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
	 *
	 * Triggers a workflow run on a canvas with optional input overrides.
	 *
	 * Options:
	 * - `duplicate` (default: true): If true, creates a copy of the canvas before running.
	 *   Set to false to run on the original canvas.
	 *
	 * Payload supports multiple file input formats:
	 * - String: Text value or legacy base64 data
	 * - { type: "base64", data: string, mimeType?: string }
	 * - { type: "url", url: string }
	 * - { type: "assetId", assetId: string }
	 */
	.post("/", zValidator("json", APIRunRequestSchema), async (c) => {
		const user = c.get("user");
		const { canvasId, payload, duplicate } = c.req.valid("json");

		try {
			assert(canvasId);
			// Verify user has access to this canvas
			await assertCanvasOwnership(c as any, canvasId);

			// Duplicate the canvas with user ownership, or use original if duplicate=false
			const targetCanvas = duplicate
				? await duplicateCanvas(canvasId, true, false, user.id)
				: { id: canvasId };

			// Optimized Payload Processing
			if (payload && Object.keys(payload).length > 0) {
				const originalNodeIds = Object.keys(payload);

				// Fetch both Text and File nodes that match the payload keys
				const nodes = await prisma.node.findMany({
					where: {
						canvasId: targetCanvas.id,
						// When duplicating, nodes have originalNodeId; when not, match by id directly
						...(duplicate
							? { originalNodeId: { in: originalNodeIds } }
							: { id: { in: originalNodeIds } }),
						type: { in: ["Text", "File"] },
					},
				});

				// Update nodes in parallel
				await Promise.all(
					nodes.map(async (node) => {
						// Get the key used in payload (originalNodeId when duplicated, else id)
						const payloadKey = duplicate ? node.originalNodeId : node.id;
						assert(payloadKey);
						const inputData = payload[payloadKey];

						if (node.type === "Text") {
							// Text nodes only accept string values
							const textValue =
								typeof inputData === "string" ? inputData : String(inputData);
							return prisma.node.update({
								where: { id: node.id },
								data: {
									config: { content: textValue } as TextNodeConfig,
								},
							});
						}

						if (node.type === "File") {
							await processFileInput(node.id, inputData);
						}
					}),
				);
			}

			// 3. Trigger Workflow
			const wfProcessor = new NodeWFProcessor(prisma);

			let apiKey = c.req.header("x-api-key");
			if (!apiKey && user) {
				const userKey = await prisma.apiKey.findFirst({
					where: { userId: user.id },
					orderBy: { createdAt: "asc" },
				});
				if (userKey) apiKey = userKey.key;
			}

			const taskBatch = await wfProcessor.processNodes(
				targetCanvas.id,
				undefined,
				apiKey,
			);
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

/**
 * Process file input in various formats
 */
async function processFileInput(nodeId: string, inputData: NodeInput) {
	if (typeof inputData === "string") {
		// Legacy: raw base64 or data URI string
		await handleBase64Upload(nodeId, inputData);
	} else if (inputData.type === "base64") {
		// Structured base64 input
		await handleBase64Upload(nodeId, inputData.data, inputData.mimeType);
	} else if (inputData.type === "url") {
		// URL input: fetch and upload
		await handleUrlUpload(nodeId, inputData.url);
	} else if (inputData.type === "assetId") {
		// Asset reference: copy existing asset to node
		await handleAssetCopy(nodeId, inputData.assetId);
	}
}

/**
 * Handle base64 file upload (legacy string or structured)
 */
async function handleBase64Upload(
	nodeId: string,
	base64Data: string,
	mimeType?: string,
): Promise<void> {
	// Strip 'data:image/xyz;base64,' prefix if present
	const rawBase64 = base64Data.includes("base64,")
		? base64Data.split("base64,")[1]
		: base64Data;

	const buffer = Buffer.from(rawBase64, "base64");
	const filename = `api-upload-${generateId()}`;

	await uploadToImportNode({
		nodeId,
		buffer,
		filename,
		mimeType,
	});
}

/**
 * Handle URL file upload - fetches from URL and uploads
 */
async function handleUrlUpload(nodeId: string, url: string): Promise<void> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch file from URL: ${url}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	// Extract filename from URL or generate one
	const urlPath = new URL(url).pathname;
	const filename = urlPath.split("/").pop() || `url-upload-${generateId()}`;

	// Try to get mime type from response headers
	const mimeType = response.headers.get("content-type") || undefined;

	await uploadToImportNode({
		nodeId,
		buffer,
		filename,
		mimeType,
	});
}

/**
 * Handle asset copy - copies existing asset to node result
 */
async function handleAssetCopy(nodeId: string, assetId: string): Promise<void> {
	const asset = await prisma.fileAsset.findUnique({
		where: { id: assetId },
	});

	if (!asset) {
		throw new Error(`Asset with id ${assetId} not found`);
	}

	// Fetch the node and its output handle
	const node = await prisma.node.findUnique({
		where: { id: nodeId },
		include: {
			handles: {
				where: { type: "Output" },
				orderBy: { order: "asc" },
			},
		},
	});

	if (!node) {
		throw new Error(`Node with id ${nodeId} not found`);
	}

	const outputHandle = node.handles[0];
	if (!outputHandle) {
		throw new Error("No output handle found for node");
	}

	// Determine data type from asset mime type
	let dataType: "Image" | "Video" | "Audio";
	if (asset.mimeType?.startsWith("image/")) {
		dataType = "Image";
	} else if (asset.mimeType?.startsWith("video/")) {
		dataType = "Video";
	} else if (asset.mimeType?.startsWith("audio/")) {
		dataType = "Audio";
	} else {
		throw new Error(`Unsupported asset type: ${asset.mimeType}`);
	}

	// Build the result structure
	const currentResult = (node.result as any) || { outputs: [] };
	const outputs = currentResult.outputs || [];
	const newIndex = outputs.length;

	const newOutput = {
		items: [
			{
				outputHandleId: outputHandle.id,
				data: { entity: asset },
				type: dataType,
			},
		],
	};

	const updatedResult = {
		...currentResult,
		selectedOutputIndex: newIndex,
		outputs: [...outputs, newOutput],
	};

	await prisma.node.update({
		where: { id: nodeId },
		data: { result: updatedResult },
	});
}

export { apiRunRoutes };
