import assert from "node:assert";
import { type Node, prisma, type TaskBatch } from "@gatewai/db";

type BatchResult = Record<Node["id"], string>;
/**
 * Resolves Export'ed result of canvas run
 */
export async function resolveBatchResult(
	batchId: TaskBatch["id"],
): Record<Node["id"], string> {
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

	exportNodes.forEach((exportNode) => {
		const originalNode = originalExportNodes.find(
			(f) => f.id === exportNode?.originalNodeId,
		);

		const result = originalNode?.result;
	});
}
