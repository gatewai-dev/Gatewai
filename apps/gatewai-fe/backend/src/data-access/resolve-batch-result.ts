import assert from "node:assert";
import type { APIResponse } from "@gatewai/api-client";
import { type Node, prisma, type TaskBatch } from "@gatewai/db";
import type { ExportResult, FileData } from "@gatewai/types";
import { ENV_CONFIG } from "../config.js";
import { bufferToDataUrl } from "../utils/image.js";
import { getFromGCS } from "../utils/storage.js";

type BatchResult = APIResponse["result"];

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
		const buffer = await getFromGCS(
			data.entity.id,
			ENV_CONFIG.GCS_ASSETS_BUCKET,
		);
		const dataUrl = bufferToDataUrl(buffer, data.entity.mimeType);
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

	assert(exportNodes.length > 1);

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
		if (originalNode) {
			const result = originalNode?.result as unknown as ExportResult;
			const selectedOutput = result.outputs[result.selectedOutputIndex];
			const outputItem = selectedOutput.items[0];
			let outputData: string | number | boolean | undefined;
			if (isOutputItemFileData(outputItem.data)) {
				outputData = await overrideFileResult(outputItem.data);
			} else {
				outputData = outputItem.data;
			}
			if (outputData) {
				allResults[originalNode?.id] = {
					type: outputItem.type,
					data: outputData,
				} as any; // TODO: Eww, need to fix this.
			}
		}
	}

	return allResults;
}
