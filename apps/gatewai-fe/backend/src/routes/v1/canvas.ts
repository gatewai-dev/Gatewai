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
import { streamSSE, streamText } from "hono/streaming";
import z from "zod";
import { RunCanvasAgent } from "../../agent/runner/index.js";
import { canvasAgentState } from "../../agent/state.js";
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

		const existingCanvas = await prisma.canvas.findFirst({
			where: { id },
		});

		if (!existingCanvas) {
			throw new HTTPException(404, { message: "Canvas not found" });
		}

		// --- 1. Fetch Existing Entities to determine Updates vs Creates ---
		const nodesInDB = await prisma.node.findMany({
			where: { canvasId: id },
			select: { id: true },
		});
		const nodeIdsInDBSet = new Set(nodesInDB.map((m) => m.id));

		const edgesInDB = await prisma.edge.findMany({
			where: { sourceNode: { canvasId: id } }, // Optimized query
			select: { id: true },
		});
		const edgeIdsInDBSet = new Set(edgesInDB.map((m) => m.id));

		const handlesInDB = await prisma.handle.findMany({
			where: { node: { canvasId: id } },
			select: { id: true },
		});
		const handleIdsInDBSet = new Set(handlesInDB.map((m) => m.id));

		// --- 2. ID Remapping Maps ---
		// These maps store the mapping from "Client Provided ID" (temp) -> "Server Generated ID" (UUID)
		const nodeIdMap = new Map<string, string>();
		const handleIdMap = new Map<string, string>();
		const edgeIdMap = new Map<string, string>();

		// --- 3. Process Nodes ---
		const nodesToCreate = [];
		const nodesToUpdate = [];
		// Track IDs that are "kept" (exist in DB and present in Payload)
		const keptNodeIds = new Set<string>();

		const nodesInPayload = validated.nodes ?? [];

		for (const n of nodesInPayload) {
			const clientSideId = n.id;
			let serverSideId = clientSideId;

			// If no ID or ID not in DB, treat as NEW
			if (!clientSideId || !nodeIdsInDBSet.has(clientSideId)) {
				serverSideId = randomUUID();
				nodesToCreate.push({ ...n, id: serverSideId });

				// Map the temp ID (if provided) to the new real ID
				if (clientSideId) {
					nodeIdMap.set(clientSideId, serverSideId);
				}
			} else {
				// It's an update
				nodesToUpdate.push(n);
				keptNodeIds.add(clientSideId);
				// Map self to self for consistency
				nodeIdMap.set(clientSideId, clientSideId);
			}
		}

		// --- 4. Process Handles ---
		const handlesToCreate = [];
		const handlesToUpdate = [];
		const keptHandleIds = new Set<string>();

		const handlesInPayload = validated.handles ?? [];

		for (const h of handlesInPayload) {
			// Resolve Parent Node ID
			// If the handle belongs to a new node, we must use the remapped Node ID
			const resolvedNodeId = nodeIdMap.get(h.nodeId) ?? h.nodeId;

			// Sanity check: If we can't find the node (and it's not being created), skip
			// Note: We skip check here strictly to allow loose coupling, but DB FK will fail if invalid.

			const clientSideId = h.id;
			let serverSideId = clientSideId;

			if (!clientSideId || !handleIdsInDBSet.has(clientSideId)) {
				serverSideId = randomUUID();
				handlesToCreate.push({
					...h,
					id: serverSideId,
					nodeId: resolvedNodeId,
				});

				if (clientSideId) {
					handleIdMap.set(clientSideId, serverSideId);
				}
			} else {
				handlesToUpdate.push({ ...h, nodeId: resolvedNodeId });
				keptHandleIds.add(clientSideId);
				handleIdMap.set(clientSideId, clientSideId);
			}
		}

		// --- 5. Process Edges ---
		const edgesToCreate = [];
		const edgesToUpdate = [];
		const keptEdgeIds = new Set<string>();

		const edgesInPayload = validated.edges ?? [];

		for (const e of edgesInPayload) {
			if (!e.sourceHandleId || !e.targetHandleId) {
				continue;
			}
			// Resolve References
			const resolvedSource = nodeIdMap.get(e.source) ?? e.source;
			const resolvedTarget = nodeIdMap.get(e.target) ?? e.target;
			const resolvedSourceHandle =
				handleIdMap.get(e.sourceHandleId) ?? e.sourceHandleId;
			const resolvedTargetHandle =
				handleIdMap.get(e.targetHandleId) ?? e.targetHandleId;

			// Check validity of resolved IDs (basic check to prevent DB errors)
			if (!resolvedSource || !resolvedTarget) {
				console.warn(`Skipping edge ${e.id}: unresolved source/target`);
				continue;
			}

			const clientSideId = e.id;
			let serverSideId = clientSideId;

			if (!clientSideId || !edgeIdsInDBSet.has(clientSideId)) {
				serverSideId = randomUUID();
				edgesToCreate.push({
					...e,
					id: serverSideId,
					source: resolvedSource,
					target: resolvedTarget,
					sourceHandleId: resolvedSourceHandle,
					targetHandleId: resolvedTargetHandle,
				});

				if (clientSideId) edgeIdMap.set(clientSideId, serverSideId);
			} else {
				edgesToUpdate.push({
					...e,
					source: resolvedSource,
					target: resolvedTarget,
					sourceHandleId: resolvedSourceHandle,
					targetHandleId: resolvedTargetHandle,
				});
				keptEdgeIds.add(clientSideId);
			}
		}

		// --- 6. Determine Deletions ---
		// Delete anything in DB that was NOT in the "kept" sets
		const removedNodeIds = Array.from(nodeIdsInDBSet).filter(
			(id) => !keptNodeIds.has(id),
		);
		const removedEdgeIds = Array.from(edgeIdsInDBSet).filter(
			(id) => !keptEdgeIds.has(id),
		);
		const removedHandleIds = Array.from(handleIdsInDBSet).filter(
			(id) => !keptHandleIds.has(id),
		);

		// --- 7. Transaction ---
		const txs = [];

		// A. Deletions (Edges -> Handles -> Nodes to respect FK)
		if (removedEdgeIds.length > 0) {
			txs.push(
				prisma.edge.deleteMany({ where: { id: { in: removedEdgeIds } } }),
			);
		}
		if (removedHandleIds.length > 0) {
			txs.push(
				prisma.handle.deleteMany({ where: { id: { in: removedHandleIds } } }),
			);
		}
		if (removedNodeIds.length > 0) {
			txs.push(
				prisma.node.deleteMany({ where: { id: { in: removedNodeIds } } }),
			);
		}

		// B. Creates
		if (nodesToCreate.length > 0) {
			txs.push(
				prisma.node.createMany({
					data: nodesToCreate.map((n) => ({
						id: n.id, // Server generated UUID
						result: n.result as any,
						config: n.config as any,
						name: n.name,
						width: n.width,
						height: n.height,
						type: n.type,
						templateId: n.templateId,
						position: n.position,
						canvasId: id,
					})),
				}),
			);
		}

		// C. Updates (Nodes) - Fetch templates to check terminal status
		if (nodesToUpdate.length > 0) {
			const updatedNodeTemplateIds = nodesToUpdate
				.map((m) => m.templateId)
				.filter((id): id is string => !!id);

			const updatedNodeTemplates = await prisma.nodeTemplate.findMany({
				where: { id: { in: updatedNodeTemplateIds } },
			});

			const isTerminalNode = (templateId: string) => {
				const nodeTemplate = updatedNodeTemplates.find(
					(f) => f.id === templateId,
				);
				return nodeTemplate ? nodeTemplate.isTerminalNode : false;
			};

			nodesToUpdate.forEach((uNode) => {
				const updateData: NodeUpdateInput = {
					config: uNode.config as any,
					position: uNode.position,
					name: uNode.name,
				};

				if (!isTerminalNode(uNode.templateId)) {
					updateData.result = uNode.result as any;
				}

				if (uNode.result) {
					updateData.result = {
						selectedOutputIndex: uNode.result?.selectedOutputIndex,
						outputs: (uNode.result as NodeResult).outputs,
					} as NodeResult;
				}

				txs.push(
					prisma.node.update({ data: updateData, where: { id: uNode.id } }),
				);
			});
		}

		// D. Creates (Handles)
		if (handlesToCreate.length > 0) {
			txs.push(
				prisma.handle.createMany({
					data: handlesToCreate.map((h) => ({
						id: h.id,
						nodeId: h.nodeId, // Already resolved
						required: h.required,
						dataTypes: h.dataTypes,
						label: h.label,
						order: h.order,
						templateHandleId: h.templateHandleId,
						type: h.type,
					})),
				}),
			);
		}

		// E. Updates (Handles)
		handlesToUpdate.forEach((uHandle) => {
			txs.push(
				prisma.handle.update({
					data: {
						type: uHandle.type,
						dataTypes: uHandle.dataTypes,
						label: uHandle.label,
						order: uHandle.order,
						required: uHandle.required,
						templateHandleId: uHandle.templateHandleId,
					},
					where: { id: uHandle.id },
				}),
			);
		});

		// F. Creates (Edges)
		if (edgesToCreate.length > 0) {
			txs.push(
				prisma.edge.createMany({
					data: edgesToCreate.map((e) => ({
						id: e.id,
						source: e.source, // Already resolved
						sourceHandleId: e.sourceHandleId, // Already resolved
						target: e.target,
						targetHandleId: e.targetHandleId,
					})),
				}),
			);
		}

		// G. Updates (Edges)
		edgesToUpdate.forEach((uEdge) => {
			txs.push(
				prisma.edge.update({
					data: {
						source: uEdge.source,
						sourceHandleId: uEdge.sourceHandleId,
						target: uEdge.target,
						targetHandleId: uEdge.targetHandleId,
					},
					where: { id: uEdge.id },
				}),
			);
		});

		// Execute
		await prisma.$transaction(txs);

		// --- Return Full Response ---
		const finalCanvas = await prisma.canvas.findFirst({ where: { id } });
		const finalNodes = await prisma.node.findMany({
			where: { canvasId: id },
			include: { template: true },
		});
		const finalEdges = await prisma.edge.findMany({
			where: { sourceNode: { canvasId: id } },
		});
		const finalHandles = await prisma.handle.findMany({
			where: { nodeId: { in: finalNodes.map((m) => m.id) } },
		});

		return c.json({
			canvas: finalCanvas,
			edges: finalEdges,
			nodes: finalNodes,
			handles: finalHandles,
		});
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
	.get("/:id/agent/status", (c) => {
		const canvasId = c.req.param("id");
		const isLocked = canvasAgentState.isLocked(canvasId);
		return c.json({ isLocked });
	})
	.get("/:id/agent/events", (c) => {
		const canvasId = c.req.param("id");

		return streamSSE(c, async (stream) => {
			// Send initial state
			await stream.writeSSE({
				data: JSON.stringify({
					type: "LOCK_STATUS",
					isLocked: canvasAgentState.isLocked(canvasId),
				}),
			});

			const listener = async (changedCanvasId: string, isLocked: boolean) => {
				if (changedCanvasId === canvasId) {
					await stream.writeSSE({
						data: JSON.stringify({
							type: "LOCK_STATUS",
							isLocked,
						}),
					});
				}
			};

			canvasAgentState.on("change", listener);

			stream.onAbort(() => {
				canvasAgentState.off("change", listener);
			});

			// Keep connection alive
			while (true) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}

			// Cleanup is handled by Hono/runtime when connection closes (conceptually),
			// but explicit cleanup in streamSSE loop break is tricky without AbortSignal.
			// However, Hono's streamSSE usually handles close.
			// Ideally we should remove listener.
			// For now, we rely on the loop breaking if write fails?
			// Actually, streamSSE callback doesn't easily support cleanup on disconnect unless we catch error.
		});
	})
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
				text: (e.content as any)?.text || "", // Assuming content structure
				createdAt: e.createdAt,
			}));

		return c.json({ ...session, messages });
	});

export { canvasRoutes };
