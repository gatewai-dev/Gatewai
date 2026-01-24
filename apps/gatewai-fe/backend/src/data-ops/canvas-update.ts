import { randomUUID } from "node:crypto";
import type { NodeUpdateInput } from "@gatewai/db";
import { prisma } from "@gatewai/db";
import type { BulkUpdatePayload, NodeResult } from "@gatewai/types";

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
		const isNew = !clientId || !dbState.nodeIds.has(clientId);
		const serverId = isNew ? randomUUID() : clientId;

		if (clientId) idMap.nodes.set(clientId, serverId);

		if (isNew) {
			ops.nodes.create.push({ ...n, id: serverId });
		} else {
			ops.nodes.update.push(n);
			ops.nodes.keepIds.add(clientId);
		}
	}

	// B. Process Handles
	for (const h of validated.handles ?? []) {
		const resolvedNodeId = idMap.nodes.get(h.nodeId) ?? h.nodeId;
		const clientId = h.id;
		const isNew = !clientId || !dbState.handleIds.has(clientId);
		const serverId = isNew ? randomUUID() : clientId;

		if (clientId) idMap.handles.set(clientId, serverId);

		const handleData = { ...h, nodeId: resolvedNodeId, id: serverId };

		if (isNew) {
			ops.handles.create.push(handleData);
		} else {
			ops.handles.update.push(handleData);
			ops.handles.keepIds.add(clientId);
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
		const sourceHandle =
			idMap.handles.get(e.sourceHandleId) ?? e.sourceHandleId;
		const targetHandle =
			idMap.handles.get(e.targetHandleId) ?? e.targetHandleId;

		if (!source || !target || !sourceHandle || !targetHandle) {
			console.warn(`[Patch] Skipping Edge ${e.id}: Unresolved reference.`);
			continue;
		}

		const clientId = e.id;
		const isNew = !clientId || !dbState.edgeIds.has(clientId);
		const serverId = isNew ? randomUUID() : clientId;

		if (clientId) idMap.edges.set(clientId, serverId);

		const edgeData = {
			...e,
			id: serverId,
			source,
			target,
			sourceHandleId: sourceHandle,
			targetHandleId: targetHandle,
		};

		if (isNew) {
			ops.edges.create.push(edgeData);
		} else {
			ops.edges.update.push(edgeData);
			ops.edges.keepIds.add(clientId);
		}
	}

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
				data: ops.nodes.create.map((n) => ({
					id: n.id,
					canvasId,
					name: n.name,
					type: n.type,
					position: n.position,
					width: n.width,
					height: n.height,
					templateId: n.templateId,
					config: n.config,
					result: n.result,
				})),
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

			transactionSteps.push(
				prisma.node.update({ where: { id: uNode.id }, data }),
			);
		}
	}

	if (ops.handles.create.length) {
		transactionSteps.push(
			prisma.handle.createMany({
				data: ops.handles.create.map((h) => ({
					id: h.id,
					nodeId: h.nodeId,
					type: h.type,
					label: h.label,
					required: h.required,
					order: h.order,
					dataTypes: h.dataTypes,
					templateHandleId: h.templateHandleId,
				})),
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
				data: ops.edges.create.map((e) => ({
					id: e.id,
					source: e.source,
					target: e.target,
					sourceHandleId: e.sourceHandleId,
					targetHandleId: e.targetHandleId,
				})),
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
