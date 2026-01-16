import { type Canvas, prisma } from "@gatewai/db";
import type { AllNodeConfig } from "@gatewai/types";

/**
 * Duplicates a canvas, including its nodes, handles, and edges.
 * Preserves mapping from duplicated nodes back to their originals for API data passing.
 * @param canvasId - The ID of the canvas to duplicate.
 * @param isAPICanvas - Whether or not duplicated canvas will be used for API request.
 * @param keepConfigAndResults - Whether to keep the config and results of the nodes in the duplicate.
 * @returns The newly created duplicated canvas.
 * @throws Error if the original canvas is not found.
 */
async function duplicateCanvas(
	canvasId: string,
	isAPICanvas = false,
	keepConfigAndResults: boolean = false,
): Promise<Canvas> {
	const originalCanvas = await prisma.canvas.findUniqueOrThrow({
		where: { id: canvasId },
	});

	const originalNodes = await prisma.node.findMany({
		where: { canvasId },
		include: { handles: true },
	});

	const originalNodeIds = originalNodes.map((node) => node.id);

	const originalEdges = await prisma.edge.findMany({
		where: {
			OR: [
				{ source: { in: originalNodeIds } },
				{ target: { in: originalNodeIds } },
			],
		},
	});

	return prisma.$transaction(async (tx) => {
		const newCanvas = await tx.canvas.create({
			data: {
				name: `${originalCanvas.name} (copy)`,
				isAPICanvas: isAPICanvas,
				originalCanvasId: originalCanvas.id,
			},
		});

		const oldToNewNodeId: { [oldId: string]: string } = {};
		const oldToNewHandleId: { [oldId: string]: string } = {};

		for (const originalNode of originalNodes) {
			const newNode = await tx.node.create({
				data: {
					name: originalNode.name,
					type: originalNode.type,
					// biome-ignore lint/suspicious/noExplicitAny: Insignificant
					position: originalNode.position as unknown as any,
					width: originalNode.width,
					height: originalNode.height,
					draggable: originalNode.draggable,
					selectable: originalNode.selectable,
					deletable: originalNode.deletable,
					config: keepConfigAndResults
						? (originalNode.config as AllNodeConfig)
						: undefined,
					isDirty: false,
					result: keepConfigAndResults ? originalNode.result : undefined,
					zIndex: originalNode.zIndex,
					canvasId: newCanvas.id,
					templateId: originalNode.templateId,
					originalNodeId: originalNode.id,
				},
			});

			oldToNewNodeId[originalNode.id] = newNode.id;

			for (const originalHandle of originalNode.handles) {
				const newHandle = await tx.handle.create({
					data: {
						type: originalHandle.type,
						dataTypes: originalHandle.dataTypes,
						label: originalHandle.label,
						description: originalHandle.description,
						order: originalHandle.order,
						required: originalHandle.required,
						templateHandleId: originalHandle.templateHandleId,
						nodeId: newNode.id,
					},
				});

				oldToNewHandleId[originalHandle.id] = newHandle.id;
			}
		}

		for (const originalEdge of originalEdges) {
			const newSource = oldToNewNodeId[originalEdge.source];
			const newTarget = oldToNewNodeId[originalEdge.target];
			const newSourceHandleId = oldToNewHandleId[originalEdge.sourceHandleId];
			const newTargetHandleId = oldToNewHandleId[originalEdge.targetHandleId];

			await tx.edge.create({
				data: {
					source: newSource,
					target: newTarget,
					sourceHandleId: newSourceHandleId,
					targetHandleId: newTargetHandleId,
				},
			});
		}

		return newCanvas;
	});
}

export { duplicateCanvas };
