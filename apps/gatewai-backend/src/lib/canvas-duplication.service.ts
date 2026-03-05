import { prisma } from "@gatewai/db";

export async function duplicateCanvas(
	originalCanvasId: string,
	newCanvasName: string,
	userId: string,
) {
	const original = await prisma.canvas.findFirst({
		where: { id: originalCanvasId },
		include: {
			nodes: {
				include: {
					template: true,
					handles: true,
				},
			},
		},
	});

	if (!original) {
		throw new Error("Canvas not found");
	}

	const originalEdges = await prisma.edge.findMany({
		where: { sourceNode: { canvasId: originalCanvasId } },
	});

	const duplicate = await prisma.canvas.create({
		data: { name: newCanvasName, userId },
	});

	const nodeCreations = original.nodes.map((node) =>
		prisma.node.create({
			data: {
				name: node.name,
				type: node.type,
				position: node.position as any,
				width: node.width,
				height: node.height,
				config: node.config ?? {},
				templateId: node.templateId,
				canvasId: duplicate.id,
			},
		}),
	);

	const newNodes = await prisma.$transaction(nodeCreations);

	const nodeIdMap = new Map<string, string>();
	original.nodes.forEach((oldNode, index) => {
		nodeIdMap.set(oldNode.id, newNodes[index].id);
	});

	const handleCreations = [];
	const tempHandleMapping: { oldId: string; newNodeId: string }[] = [];

	for (let i = 0; i < original.nodes.length; i++) {
		const oldNode = original.nodes[i];
		const newNodeId = newNodes[i].id;
		for (const oldHandle of oldNode.handles) {
			tempHandleMapping.push({
				oldId: oldHandle.id,
				newNodeId: newNodeId,
			});

			handleCreations.push(
				prisma.handle.create({
					data: {
						nodeId: newNodeId,
						type: oldHandle.type,
						dataTypes: oldHandle.dataTypes,
						label: oldHandle.label,
						order: oldHandle.order,
						required: oldHandle.required,
						templateHandleId: oldHandle.templateHandleId,
					},
				}),
			);
		}
	}

	const newHandles = await prisma.$transaction(handleCreations);

	const handleIdMap = new Map<string, string>();
	for (let i = 0; i < tempHandleMapping.length; i++) {
		handleIdMap.set(tempHandleMapping[i].oldId, newHandles[i].id);
	}

	const edgeCreations = originalEdges
		.map((edge) => {
			const hasHandleIds = edge.sourceHandleId && edge.targetHandleId;
			if (!hasHandleIds) return null;

			const newSource = nodeIdMap.get(edge.source);
			const newTarget = nodeIdMap.get(edge.target);
			const newSourceHandleId = handleIdMap.get(edge.sourceHandleId);
			const newTargetHandleId = handleIdMap.get(edge.targetHandleId);

			if (
				!newSource ||
				!newTarget ||
				!newSourceHandleId ||
				!newTargetHandleId
			) {
				return null;
			}

			return prisma.edge.create({
				data: {
					source: newSource,
					target: newTarget,
					sourceHandleId: newSourceHandleId,
					targetHandleId: newTargetHandleId,
				},
			});
		})
		.filter((e) => e !== null);

	if (edgeCreations.length > 0) {
		await prisma.$transaction(edgeCreations);
	}

	return { canvas: { ...duplicate, nodes: newNodes } };
}
