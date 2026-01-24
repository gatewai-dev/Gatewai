import { prisma } from "@gatewai/db";
import {
	type BulkUpdatePayload,
	bulkUpdateSchema,
	processSchema,
} from "@gatewai/types";
import { zValidator } from "@hono/zod-validator";
import type { XYPosition } from "@xyflow/react";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import z from "zod";
import { RunCanvasAgent } from "../../agent/runner/index.js";
import { canvasAgentState } from "../../agent/state.js";
import type { AuthHonoTypes } from "../../auth.js";
import { GetCanvasEntities } from "../../data-ops/canvas.js";
import { applyCanvasUpdate } from "../../data-ops/canvas-update.js";
import { NodeWFProcessor } from "../../graph-engine/canvas-workflow-processor.js";
import { logger } from "../../logger.js";
import { assertIsError } from "../../utils/misc.js";

const canvasRoutes = new Hono<{ Variables: AuthHonoTypes }>({
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
		const user = c.get("user");
		if (!user) {
			c.json({ error: "Unauthenticated" }, 401);
		}
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

		try {
			await applyCanvasUpdate(id, validated);
		} catch (error) {
			assertIsError(error);
			logger.error(`Canvas Bulk Update Failed: ${error.message}`);
			throw new HTTPException(500, {
				message: "Failed to save canvas updates.",
			});
		}

		const response = await GetCanvasEntities(id);
		return c.json(response);
	})
	.post("/:id/patches", zValidator("json", bulkUpdateSchema), async (c) => {
		const id = c.req.param("id");
		const agentSessionId = c.req.query("agentSessionId");
		const validated = c.req.valid("json");

		const patch = await prisma.canvasPatch.create({
			data: {
				canvasId: id,
				patch: validated as object,
				status: "PENDING",
				agentSessionId: agentSessionId,
			},
		});

		canvasAgentState.notifyPatch(id, patch.id);

		return c.json(patch, 201);
	})
	.post("/:id/patches/:patchId/apply", async (c) => {
		const id = c.req.param("id");
		const patchId = c.req.param("patchId");

		const patch = await prisma.canvasPatch.findUnique({
			where: { id: patchId },
		});

		if (!patch || patch.canvasId !== id) {
			throw new HTTPException(404, { message: "Patch not found" });
		}

		if (patch.status !== "PENDING") {
			throw new HTTPException(400, { message: "Patch is not pending" });
		}

		try {
			await applyCanvasUpdate(id, patch.patch as unknown as BulkUpdatePayload);
			await prisma.canvasPatch.update({
				where: { id: patchId },
				data: { status: "ACCEPTED" },
			});

			// Log event if session exists
			if (patch.agentSessionId) {
				await prisma.event.create({
					data: {
						agentSessionId: patch.agentSessionId,
						eventType: "patch_action",
						role: "USER",
						content: {
							action: "ACCEPTED",
							patchId: patch.id,
							text: "User accepted the proposed changes.",
						},
					},
				});
			}
		} catch (error) {
			console.error("Failed to apply patch:", error);
			throw new HTTPException(500, { message: "Failed to apply patch" });
		}

		const response = await GetCanvasEntities(id);
		return c.json(response);
	})
	.post("/:id/patches/:patchId/reject", async (c) => {
		const id = c.req.param("id");
		const patchId = c.req.param("patchId");

		const patch = await prisma.canvasPatch.findUnique({
			where: { id: patchId },
		});

		if (!patch || patch.canvasId !== id) {
			throw new HTTPException(404, { message: "Patch not found" });
		}

		await prisma.canvasPatch.update({
			where: { id: patchId },
			data: { status: "REJECTED" },
		});

		// Log event if session exists
		if (patch.agentSessionId) {
			await prisma.event.create({
				data: {
					agentSessionId: patch.agentSessionId,
					eventType: "patch_action",
					role: "USER",
					content: {
						action: "REJECTED",
						patchId: patch.id,
						text: "User rejected the proposed changes.",
					},
				},
			});
		}

		return c.json({ success: true });
	})
	.get("/:id/patches/:patchId", async (c) => {
		const id = c.req.param("id");
		const patchId = c.req.param("patchId");

		const patch = await prisma.canvasPatch.findUnique({
			where: { id: patchId },
		});

		if (!patch || patch.canvasId !== id) {
			throw new HTTPException(404, { message: "Patch not found" });
		}

		return c.json(patch);
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
				model: z.string(),
			}),
		),
		async (c) => {
			const canvasId = c.req.param("id");
			const sessionId = c.req.param("sessionId");
			const { message, model } = c.req.valid("json");

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
				const onPatch = async (cId: string, pId: string) => {
					if (cId === canvasId) {
						await stream.writeSSE({
							data: JSON.stringify({
								type: "patch_proposed",
								patchId: pId,
							}),
							event: "patch_proposed",
						});
					}
				};

				canvasAgentState.on("patch", onPatch);

				try {
					const runner = RunCanvasAgent({
						canvasId,
						sessionId,
						userMessage: message,
						model,
					});

					for await (const delta of runner) {
						await stream.write(JSON.stringify(delta));
					}
				} finally {
					canvasAgentState.off("patch", onPatch);
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
