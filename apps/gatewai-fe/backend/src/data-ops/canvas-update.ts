import type { NodeUpdateInput } from "@gatewai/db";
import { prisma } from "@gatewai/db";
import type { BulkUpdatePayload, NodeResult } from "@gatewai/types";
import { generateId } from "../utils/misc.js";

export async function applyCanvasUpdate(
	canvasId: string,
	validated: BulkUpdatePayload,
) {
	// 1. Verify Canvas Existence
	const existingCanvas = await prisma.canvas.findFirst({
		where: { id: canvasId },
		select: { id: true, version: true },
	});

	if (!existingCanvas) {
		throw new Error("Canvas not found");
	}

	// --- PHASE 1: Fetch Current State (Snapshoting) ---
	const [nodesInDB, edgesInDB, handlesInDB] = await Promise.all([
		prisma.node.findMany({ where: { canvasId }, select: { id: true } }),
		prisma.edge.findMany({
			where: { sourceNode: { canvasId } },
			select: { id: true },
		}),
		prisma.handle.findMany({
			where: { node: { canvasId } },
			select: { id: true },
		}),
	]);

	const dbState = {
		nodeIds: new Set(nodesInDB.map((n) => n.id)),
		edgeIds: new Set(edgesInDB.map((e) => e.id)),
		handleIds: new Set(handlesInDB.map((h) => h.id)),
	};

	// --- PHASE 2: ID Remapping & Diff Calculation ---
	const idMap = {
		nodes: new Map<string, string>(),
		handles: new Map<string, string>(),
		edges: new Map<string, string>(),
	};

	const ops = {
		nodes: {
			create: [] as any[],
			update: [] as any[],
			keepIds: new Set<string>(),
		},
		handles: {
			create: [] as any[],
			update: [] as any[],
			keepIds: new Set<string>(),
		},
		edges: {
			create: [] as any[],
			update: [] as any[],
			keepIds: new Set<string>(),
		},
	};

	// A. Process Nodes
	for (const n of validated.nodes ?? []) {
		const clientId = n.id;
		const shouldOverride = clientId ? clientId.startsWith("temp-") : true;
		const serverId = shouldOverride ? generateId() : (clientId as string);

		if (shouldOverride && clientId) {
			idMap.nodes.set(clientId, serverId);
		}

		if (shouldOverride) {
			ops.nodes.create.push({
				id: serverId,
				canvasId,
				name: n.name,
				type: n.type,
				position: n.position,
				width: n.width,
				height: n.height,
				templateId: n.templateId,
				config: n.config,
				result: n.result,
			});
		} else {
			ops.nodes.keepIds.add(serverId);
			if (dbState.nodeIds.has(serverId)) {
				ops.nodes.update.push({ ...n, id: serverId });
			} else {
				ops.nodes.create.push({
					id: serverId,
					canvasId,
					name: n.name,
					type: n.type,
					position: n.position,
					width: n.width,
					height: n.height,
					templateId: n.templateId,
					config: n.config,
					result: n.result,
				});
			}
		}
	}

	// B. Process Handles
	for (const h of validated.handles ?? []) {
		const clientId = h.id;
		const shouldOverride = clientId ? clientId.startsWith("temp-") : true;
		const serverId = shouldOverride ? generateId() : (clientId as string);

		if (shouldOverride && clientId) {
			idMap.handles.set(clientId, serverId);
		}

		const resolvedNodeId = idMap.nodes.get(h.nodeId) ?? h.nodeId;

		const handleData = {
			...h,
			id: serverId,
			nodeId: resolvedNodeId,
		};

		if (shouldOverride) {
			ops.handles.create.push({
				id: serverId,
				nodeId: resolvedNodeId,
				type: h.type,
				label: h.label,
				required: h.required,
				order: h.order,
				dataTypes: h.dataTypes,
				templateHandleId: h.templateHandleId,
			});
		} else {
			ops.handles.keepIds.add(serverId);
			if (dbState.handleIds.has(serverId)) {
				ops.handles.update.push(handleData);
			} else {
				ops.handles.create.push({
					id: serverId,
					nodeId: resolvedNodeId,
					type: h.type,
					label: h.label,
					required: h.required,
					order: h.order,
					dataTypes: h.dataTypes,
					templateHandleId: h.templateHandleId,
				});
			}
		}
	}

	// C. Process Edges
	for (const e of validated.edges ?? []) {
		// Skip edges with missing handle references
		if (!e.sourceHandleId || !e.targetHandleId) {
			console.warn(`[Patch] Skipping Edge ${e.id}: Missing handle reference.`);
			continue;
		}

		const source = idMap.nodes.get(e.source) ?? e.source;
		const target = idMap.nodes.get(e.target) ?? e.target;
		const sourceHandleId =
			idMap.handles.get(e.sourceHandleId) ?? e.sourceHandleId;
		const targetHandleId =
			idMap.handles.get(e.targetHandleId) ?? e.targetHandleId;

		if (!source || !target || !sourceHandleId || !targetHandleId) {
			console.warn(`[Patch] Skipping Edge ${e.id}: Unresolved reference.`);
			continue;
		}

		const clientId = e.id;
		const shouldOverride = clientId ? clientId.startsWith("temp-") : true;
		const serverId = shouldOverride ? generateId() : (clientId as string);

		if (shouldOverride && clientId) {
			idMap.edges.set(clientId, serverId);
		}

		const edgeData = {
			...e,
			id: serverId,
			source,
			target,
			sourceHandleId,
			targetHandleId,
		};

		if (shouldOverride) {
			ops.edges.create.push({
				id: serverId,
				source,
				target,
				sourceHandleId,
				targetHandleId,
			});
		} else {
			ops.edges.keepIds.add(serverId);
			if (dbState.edgeIds.has(serverId)) {
				ops.edges.update.push(edgeData);
			} else {
				ops.edges.create.push({
					id: serverId,
					source,
					target,
					sourceHandleId,
					targetHandleId,
				});
			}
		}
	}

	// --- PHASE 2B: Fix Config References (Remap Handle IDs in Node Configs) ---
	// Since Nodes are processed before Handles, we need to do a pass here to fix any
	// references in node configs (like layerUpdates) that point to temp handle IDs
	// which have now been remapped to server IDs.

	const fixNodeConfig = (node: any) => {
		if (
			(node.type === "Compositor" || node.type === "VideoCompositor") &&
			node.config?.layerUpdates
		) {
			const newLayerUpdates: Record<string, any> = {};
			let hasChanges = false;

			for (const [key, value] of Object.entries(node.config.layerUpdates)) {
				// check if this key (handleId) was remapped
				const remappedId = idMap.handles.get(key);
				if (remappedId) {
					newLayerUpdates[remappedId] = value;
					hasChanges = true;
				} else {
					newLayerUpdates[key] = value;
				}
			}

			if (hasChanges) {
				node.config = {
					...node.config,
					layerUpdates: newLayerUpdates,
				};
			}
		}
	};

	ops.nodes.create.forEach(fixNodeConfig);
	ops.nodes.update.forEach(fixNodeConfig);

	// --- PHASE 3: Prepare Transaction ---
	const deleteIds = {
		edges: Array.from(dbState.edgeIds).filter(
			(id) => !ops.edges.keepIds.has(id),
		),
		handles: Array.from(dbState.handleIds).filter(
			(id) => !ops.handles.keepIds.has(id),
		),
		nodes: Array.from(dbState.nodeIds).filter(
			(id) => !ops.nodes.keepIds.has(id),
		),
	};

	const transactionSteps = [];

	if (deleteIds.edges.length) {
		transactionSteps.push(
			prisma.edge.deleteMany({ where: { id: { in: deleteIds.edges } } }),
		);
	}
	if (deleteIds.handles.length) {
		transactionSteps.push(
			prisma.handle.deleteMany({ where: { id: { in: deleteIds.handles } } }),
		);
	}
	if (deleteIds.nodes.length) {
		transactionSteps.push(
			prisma.node.deleteMany({ where: { id: { in: deleteIds.nodes } } }),
		);
	}

	if (ops.nodes.create.length) {
		transactionSteps.push(
			prisma.node.createMany({
				data: ops.nodes.create,
			}),
		);
	}

	if (ops.nodes.update.length) {
		const templates = await prisma.nodeTemplate.findMany({
			where: {
				id: {
					in: ops.nodes.update
						.map((n) => n.templateId)
						.filter(Boolean) as string[],
				},
			},
			select: { id: true, isTerminalNode: true },
		});
		const terminalTemplateIds = new Set(
			templates.filter((t) => t.isTerminalNode).map((t) => t.id),
		);

		for (const uNode of ops.nodes.update) {
			const data: NodeUpdateInput = {
				name: uNode.name,
				position: uNode.position,
				config: uNode.config,
			};

			const isTerminal =
				uNode.templateId && terminalTemplateIds.has(uNode.templateId);
			if (!isTerminal && uNode.result) {
				data.result = {
					selectedOutputIndex: uNode.result?.selectedOutputIndex,
					outputs: (uNode.result as NodeResult).outputs,
				};
			}

			// If it is terminal, only update outputIndex
			if (isTerminal && uNode.result) {
				data.result = {
					...(uNode.result as NodeResult),
					selectedOutputIndex: uNode.result?.selectedOutputIndex,
				};
			}

			transactionSteps.push(
				prisma.node.update({ where: { id: uNode.id }, data }),
			);
		}
	}

	if (ops.handles.create.length) {
		transactionSteps.push(
			prisma.handle.createMany({
				data: ops.handles.create,
			}),
		);
	}
	for (const uHandle of ops.handles.update) {
		transactionSteps.push(
			prisma.handle.update({
				where: { id: uHandle.id },
				data: {
					type: uHandle.type,
					label: uHandle.label,
					required: uHandle.required,
					order: uHandle.order,
					dataTypes: uHandle.dataTypes,
					templateHandleId: uHandle.templateHandleId,
				},
			}),
		);
	}

	if (ops.edges.create.length) {
		transactionSteps.push(
			prisma.edge.createMany({
				data: ops.edges.create,
				skipDuplicates: true,
			}),
		);
	}
	for (const uEdge of ops.edges.update) {
		transactionSteps.push(
			prisma.edge.update({
				where: { id: uEdge.id },
				data: {
					source: uEdge.source,
					target: uEdge.target,
					sourceHandleId: uEdge.sourceHandleId,
					targetHandleId: uEdge.targetHandleId,
				},
			}),
		);
	}

	transactionSteps.push(
		prisma.canvas.update({
			where: { id: canvasId },
			data: {
				version: { increment: 1 },
			},
		}),
	);

	await prisma.$transaction(transactionSteps);
}
