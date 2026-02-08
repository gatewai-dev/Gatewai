import { type Canvas, prisma } from "@gatewai/db";

/**
 * Duplicates a canvas, including its nodes, handles, and edges.
 * Preserves mapping from duplicated nodes back to their originals for API data passing.
 * Remaps handle IDs in node configs (ImageCompositor/VideoCompositor layerUpdates) and results.
 * @param canvasId - The ID of the canvas to duplicate.
 * @param isAPICanvas - Whether or not duplicated canvas will be used for API request.
 * @param keepResults - Whether to keep the results of the nodes in the duplicate.
 * @param userId - The user ID to assign ownership of the duplicated canvas. If not provided, inherits from original.
 * @returns The newly created duplicated canvas.
 * @throws Error if the original canvas is not found.
 */
async function duplicateCanvas(
	canvasId: string,
	isAPICanvas = false,
	keepResults = false,
	userId?: string,
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
				userId: userId ?? originalCanvas.userId,
			},
		});

		const oldToNewNodeId: { [oldId: string]: string } = {};
		const oldToNewHandleId: { [oldId: string]: string } = {};

		// First pass: Create all nodes and handles, build the ID mappings
		for (const originalNode of originalNodes) {
			const newNode = await tx.node.create({
				data: {
					name: originalNode.name,
					type: originalNode.type,
					// biome-ignore lint/suspicious/noExplicitAny: Insignificant
					position: originalNode.position as unknown as any,
					width: originalNode.width,
					height: originalNode.height,
					// Config will be updated in second pass after handle mappings are complete
					config: originalNode.config as any,
					isDirty: false,
					result: undefined, // Results need handle remapping, done in second pass
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

		// Second pass: Remap handle IDs in configs and results
		for (const originalNode of originalNodes) {
			const newNodeId = oldToNewNodeId[originalNode.id];
			const config = originalNode.config as Record<string, unknown> | null;
			const result = originalNode.result as Record<string, unknown> | null;

			let needsUpdate = false;
			let updatedConfig = config;
			let updatedResult: Record<string, unknown> | undefined;

			// Remap layerUpdates in ImageCompositor and VideoCompositor configs
			if (
				config &&
				"layerUpdates" in config &&
				typeof config.layerUpdates === "object" &&
				config.layerUpdates !== null
			) {
				const layerUpdates = config.layerUpdates as Record<string, unknown>;
				const remappedLayerUpdates: Record<string, unknown> = {};

				for (const [oldHandleId, layerConfig] of Object.entries(layerUpdates)) {
					const newHandleId = oldToNewHandleId[oldHandleId];
					if (newHandleId) {
						// Also remap inputHandleId inside the layer config
						const layer = layerConfig as Record<string, unknown>;
						remappedLayerUpdates[newHandleId] = {
							...layer,
							inputHandleId: newHandleId,
						};
					} else {
						// Keep original if not found (shouldn't happen for valid configs)
						remappedLayerUpdates[oldHandleId] = layerConfig;
					}
				}

				updatedConfig = {
					...config,
					layerUpdates: remappedLayerUpdates,
				};
				needsUpdate = true;
			}

			// Remap outputHandleId in results if keepResults is true
			if (
				keepResults &&
				result &&
				"outputs" in result &&
				Array.isArray(result.outputs)
			) {
				const outputs = result.outputs as Array<{
					items: Array<Record<string, unknown>>;
				}>;
				const remappedOutputs = outputs.map((output) => ({
					...output,
					items: output.items.map((item) => {
						if (
							item.outputHandleId &&
							typeof item.outputHandleId === "string"
						) {
							const newHandleId = oldToNewHandleId[item.outputHandleId];
							return {
								...item,
								outputHandleId: newHandleId || item.outputHandleId,
							};
						}
						return item;
					}),
				}));

				updatedResult = {
					...result,
					outputs: remappedOutputs,
				};
				needsUpdate = true;
			}

			if (needsUpdate) {
				await tx.node.update({
					where: { id: newNodeId },
					data: {
						...(updatedConfig !== config
							? { config: updatedConfig as any }
							: {}),
						...(updatedResult ? { result: updatedResult as any } : {}),
					},
				});
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
