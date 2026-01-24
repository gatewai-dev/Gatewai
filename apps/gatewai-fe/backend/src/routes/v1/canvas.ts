import { randomUUID } from "node:crypto"; // Native UUID generation
import { type NodeUpdateInput, prisma } from "@gatewai/db";
import {
	bulkUpdateSchema,
	type NodeResult,
	processSchema,
} from "@gatewai/types";
import { zValidator } from "@hono/zod-validator";
import type { XYPosition } from "@xyflow/react";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import z from "zod";
import { RunCanvasAgent } from "../../agent/runner/index.js";
import { GetCanvasEntities } from "../../data-ops/canvas.js";
import { NodeWFProcessor } from "../../graph-engine/canvas-workflow-processor.js";

const canvasRoutes = new Hono({
	strict: false,
})
	.get("/", async (c) => {
		const canvases = await prisma.canvas.findMany({
			where: {
				isAPICanvas: false,
			},
			orderBy: {
				updatedAt: "desc",
			},
			select: {
				id: true,
				name: true,
				createdAt: true,
				updatedAt: true,
				_count: {
					select: {
						nodes: true,
					},
				},
			},
		});

		return c.json(canvases);
	})
	.post("/", async (c) => {
		const canvasCount = await prisma.canvas.count();

		const canvas = await prisma.canvas.create({
			data: {
				name: `Canvas ${canvasCount + 1}`,
			},
		});

		return c.json(canvas, 201);
	})
	.get("/:id", async (c) => {
		const id = c.req.param("id");
		const response = await GetCanvasEntities(id);
		return c.json(response);
	})
	.patch(
		"/:id/update-name",
		zValidator(
			"json",
			z.object({
				name: z.string(),
			}),
		),
		async (c) => {
			const validated = c.req.valid("json");
			const id = c.req.param("id");

			const canvas = await prisma.canvas.update({
				where: { id },
				data: { name: validated.name },
			});

			return c.json(canvas, 201);
		},
	)
	.patch("/:id", zValidator("json", bulkUpdateSchema), async (c) => {
		const id = c.req.param("id");
		const validated = c.req.valid("json");

		// 1. Verify Canvas Existence
		const existingCanvas = await prisma.canvas.findFirst({
			where: { id },
			select: { id: true, version: true },
		});

		if (!existingCanvas) {
			throw new HTTPException(404, { message: "Canvas not found" });
		}

		// --- PHASE 1: Fetch Current State (Snapshoting) ---
		// We need the current state to calculate the diff (What to delete vs update)
		const [nodesInDB, edgesInDB, handlesInDB] = await Promise.all([
			prisma.node.findMany({ where: { canvasId: id }, select: { id: true } }),
			prisma.edge.findMany({
				where: { sourceNode: { canvasId: id } },
				select: { id: true },
			}),
			prisma.handle.findMany({
				where: { node: { canvasId: id } },
				select: { id: true },
			}),
		]);

		const dbState = {
			nodeIds: new Set(nodesInDB.map((n) => n.id)),
			edgeIds: new Set(edgesInDB.map((e) => e.id)),
			handleIds: new Set(handlesInDB.map((h) => h.id)),
		};

		// --- PHASE 2: ID Remapping & Diff Calculation ---
		// We map frontend "temp" IDs to backend "real" UUIDs here.
		// This allows us to insert interdependent records in one transaction.

		const idMap = {
			nodes: new Map<string, string>(), // ClientID -> ServerUUID
			handles: new Map<string, string>(), // ClientID -> ServerUUID
			edges: new Map<string, string>(), // ClientID -> ServerUUID
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
			// If ID is missing or not in DB, it's a CREATE
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
			// Resolve parent Node ID (It might be a newly created node)
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
			// Resolve references (Source/Target nodes and handles might be new)
			const source = idMap.nodes.get(e.source) ?? e.source;
			const target = idMap.nodes.get(e.target) ?? e.target;
			const sourceHandle =
				idMap.handles.get(e.sourceHandleId) ?? e.sourceHandleId;
			const targetHandle =
				idMap.handles.get(e.targetHandleId) ?? e.targetHandleId;

			// Integrity Check: Skip edges with missing references
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

		// 1. Calculate Deletions (Anything in DB not in "keepIds" is deleted)
		// Order matters: Edges -> Handles -> Nodes (Foreign Key constraints)
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

		// Step A: Deletes
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

		// Step B: Node Operations
		if (ops.nodes.create.length) {
			transactionSteps.push(
				prisma.node.createMany({
					data: ops.nodes.create.map((n) => ({
						id: n.id,
						canvasId: id,
						name: n.name,
						type: n.type,
						position: n.position,
						width: n.width,
						height: n.height,
						templateId: n.templateId,
						config: n.config ?? {},
						result: n.result ?? {},
					})),
				}),
			);
		}

		// Logic for Node Updates (checking terminal status)
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

				// Only update result if not a terminal node, or if explicitly provided
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

		// Step C: Handle Operations
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

		// Step D: Edge Operations
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

		// Step E: Canvas Version Increment (The Revoke Mechanism)
		// If any previous step fails, this never happens.
		// If this fails, previous steps roll back.
		transactionSteps.push(
			prisma.canvas.update({
				where: { id },
				data: {
					version: { increment: 1 },
					// Optional: Update 'updatedAt' explicitly if not auto-handled
					// updatedAt: new Date()
				},
			}),
		);

		// --- PHASE 4: Execution ---
		try {
			await prisma.$transaction(transactionSteps);
		} catch (error) {
			console.error("Canvas Bulk Update Failed - Rolling back:", error);
			// We re-throw HTTP exception so Hono returns appropriate error to client.
			// Data in DB remains untouched (Atomicity).
			throw new HTTPException(500, {
				message: "Failed to save canvas updates.",
			});
		}

		// --- PHASE 5: Response ---
		// Fetch the clean, updated state to return to client
		const response = await GetCanvasEntities(id);
		return c.json(response);
	})
	.delete("/:id", async (c) => {
		const id = c.req.param("id");

		const existing = await prisma.canvas.findFirst({ where: { id } });
		if (!existing) {
			throw new HTTPException(404, { message: "Canvas not found" });
		}

		await prisma.canvas.delete({ where: { id } });
		return c.json({ success: true });
	})
	.post("/:id/duplicate", async (c) => {
		const id = c.req.param("id");

		const original = await prisma.canvas.findFirst({
			where: { id },
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
			throw new HTTPException(404, { message: "Canvas not found" });
		}

		const originalEdges = await prisma.edge.findMany({
			where: { sourceNode: { canvasId: id } },
		});

		const duplicate = await prisma.canvas.create({
			data: { name: `${original.name} (Copy)` },
		});

		const nodeCreations = original.nodes.map((node) =>
			prisma.node.create({
				data: {
					name: node.name,
					type: node.type,
					position: node.position as XYPosition,
					width: node.width,
					height: node.height,
					draggable: node.draggable,
					selectable: node.selectable,
					deletable: node.deletable,
					config: node.config ?? {},
					isDirty: node.isDirty,
					zIndex: node.zIndex,
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

		return c.json({ canvas: { ...duplicate, nodes: newNodes } }, 201);
	})
	.post("/:id/process", zValidator("json", processSchema), async (c) => {
		const canvasId = c.req.param("id");
		const validated = c.req.valid("json");

		const wfProcessor = new NodeWFProcessor(prisma);
		const taskBatch = await wfProcessor.processNodes(
			canvasId,
			validated.node_ids,
		);

		return c.json(taskBatch, 201);
	})
	.get("/:id/agent/sessions", async (c) => {
		const canvasId = c.req.param("id");
		const agentSessions = await prisma.agentSession.findMany({
			where: { canvasId },
		});
		return c.json(agentSessions);
	})
	.post(
		"/:id/agent/:sessionId",
		zValidator(
			"json",
			z.object({
				message: z.string(),
			}),
		),
		async (c) => {
			const canvasId = c.req.param("id");
			const sessionId = c.req.param("sessionId");
			const { message } = c.req.valid("json");

			// 1. Ensure Session exists
			await prisma.agentSession.upsert({
				where: { id: sessionId },
				update: {},
				create: {
					id: sessionId,
					canvasId: canvasId,
				},
			});

			// 2. Return SSE Stream
			return streamSSE(c, async (stream) => {
				const runner = RunCanvasAgent({
					canvasId,
					sessionId,
					userMessage: message,
				});

				for await (const delta of runner) {
					await stream.write(JSON.stringify(delta));
				}
			});
		},
	)
	.get("/:id/agent/:sessionId", async (c) => {
		const canvasId = c.req.param("id");
		const sessionId = c.req.param("sessionId");

		const session = await prisma.agentSession.findFirst({
			where: { id: sessionId, canvasId },
			include: {
				events: {
					orderBy: { createdAt: "asc" },
				},
			},
		});

		if (!session) {
			throw new HTTPException(404, { message: "Session not found" });
		}

		// Map events to ChatMessage format
		const messages = session.events
			.filter((e) => e.role === "USER" || e.role === "ASSISTANT")
			.map((e) => ({
				id: e.id,
				role: e.role === "USER" ? "user" : "model",
				text: (e.content as any)?.text || "",
				createdAt: e.createdAt,
			}));

		return c.json({ ...session, messages });
	});

export { canvasRoutes };
