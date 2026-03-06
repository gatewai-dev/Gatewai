import assert from "node:assert";
import { ENV_CONFIG, type StorageService } from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import type {
	FileData,
	MediaService,
	NodeResult,
	OutputItem,
	VirtualMediaData,
} from "@gatewai/core/types";
import { type DataType, type Node, prisma, type TaskBatch } from "@gatewai/db";
import type { APIRunResponse } from "./schemas.js";

type BatchResult = APIRunResponse["result"];

const isOutputItemFileData = (data: OutputItem<DataType>): data is FileData => {
	return typeof data === "object" && !("source" in data);
};

const isOutputItemVirtualMediaData = (
	item: OutputItem<DataType>,
): item is VirtualMediaData => {
	return typeof data === "object" && "source" in data;
};

async function overrideFileResult(data: FileData | VirtualMediaData) {
	const processData =
		"source" in data ? data.source.processData : data.processData;
	const entity = "source" in data ? data.source.entity : data.entity;

	if (processData?.dataUrl) {
		return processData.dataUrl;
	}
	if (entity) {
		const storage = container.get<StorageService>(TOKENS.STORAGE);
		const media = container.get<MediaService>(TOKENS.MEDIA);

		const buffer = await storage.getFromStorage(
			entity.key,
			ENV_CONFIG.GCS_ASSETS_BUCKET,
		);
		const dataUrl = media.bufferToDataUrl(buffer, entity.mimeType);
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
		const result = exportNode?.result as unknown as NodeResult | null;
		if (!originalNode?.id || !result) continue;

		const selectedOutput = result.outputs[result.selectedOutputIndex];
		const outputItem = selectedOutput.items[0];

		let outputData: string | number | boolean | undefined;

		if (
			isOutputItemFileData(outputItem.data) ||
			isOutputItemVirtualMediaData(outputItem.data)
		) {
			outputData = await overrideFileResult(outputItem.data);
		} else {
			outputData = outputItem.data;
		}

		if (outputData !== undefined) {
			allResults[originalNode.id] = {
				type: outputItem.type,
				data: outputData,
			};
		}
	}

	return allResults;
}
