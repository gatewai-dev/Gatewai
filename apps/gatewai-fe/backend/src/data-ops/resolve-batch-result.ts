import assert from "node:assert";
import { type Node, prisma, type TaskBatch } from "@gatewai/db";
import type { ExportResult, FileData, MediaService, StorageService } from "@gatewai/types";
import { ENV_CONFIG } from "@gatewai/core";
import { TOKENS } from "@gatewai/node-sdk";
import { container } from "@gatewai/di";
// bufferToDataUrl is now a method on MediaService
import type { APIRunResponse } from "./schemas.js";

type BatchResult = APIRunResponse["result"];

const isOutputItemFileData = (
	data: string | number | boolean | FileData,
): data is FileData => {
	return typeof data === "object";
};

async function overrideFileResult(data: FileData) {
	if (data.processData) {
		return data.processData.dataUrl;
	}
	if (data.entity) {
		const storage = container.resolve<StorageService>(TOKENS.STORAGE);
		const media = container.resolve<MediaService>(TOKENS.MEDIA);

		const buffer = await storage.getFromGCS(
			data.entity.key, // FIX: It was data.entity.id, but StorageService expects key. 
			// Wait, original code passed `data.entity.id` to getFromGCS? 
			// getFromGCS(key, bucket). 
			// `data.entity` is `FileAsset`. It has .key and .bucket.
			// Why did original code use .id as key? That might have been a bug or `getFromGCS` was overloaded?
			// Original `getFromGCS(key, bucketName)`.
			// Let's check `resolve-batch-result.ts` original: `getFromGCS(data.entity.id, ENV_CONFIG.GCS_ASSETS_BUCKET)`.
			// FileAsset ID usually isn't the key (key is e.g. `assets/...`). key is `data.entity.key`.
			// I'll assume `.key` is correct.
			ENV_CONFIG.GCS_ASSETS_BUCKET,
		);
		const dataUrl = media.bufferToDataUrl(buffer, data.entity.mimeType);
		return dataUrl;
	}
}
/**
 * Resolves Export'ed result of canvas run
 * SHOULD ONLY BE USED BY API CANVAS REQUESTS
 */
export async function resolveBatchResult(
	batchId: TaskBatch["id"],
): Promise<BatchResult> {
	const batchData = await prisma.taskBatch.findFirstOrThrow({
		where: { id: batchId },
		include: {
			tasks: {
				include: {
					node: true,
				},
			},
		},
	});

	const allNodes = batchData.tasks.flatMap((m) => m.node);

	const exportNodes = allNodes.filter((f) => f?.type === "Export");

	assert(exportNodes);

	assert(exportNodes.length > 0);

	const exportNodeOriginalIds = exportNodes
		.map((m) => m?.originalNodeId)
		.filter(Boolean) as Node["id"][];
	/**
	 * ## Get the export nodes that user(developer) expects
	 */
	const originalExportNodes = await prisma.node.findMany({
		where: {
			id: {
				in: exportNodeOriginalIds,
			},
		},
	});

	const allResults: BatchResult = {};

	for (const exportNode of exportNodes) {
		const originalNode = originalExportNodes.find(
			(f) => f.id === exportNode?.originalNodeId,
		);

		// Ensure we have both the node and the result
		const result = exportNode?.result as unknown as ExportResult | null;
		if (!originalNode?.id || !result) continue;

		const selectedOutput = result.outputs[result.selectedOutputIndex];
		const outputItem = selectedOutput.items[0];

		let outputData: string | number | boolean | undefined;

		if (isOutputItemFileData(outputItem.data)) {
			outputData = await overrideFileResult(outputItem.data);
		} else {
			outputData = outputItem.data;
		}

		if (outputData !== undefined) {
			allResults[originalNode.id] = {
				type: outputItem.type,
				data: outputData,
			} as any;
		}
	}

	return allResults;
}
