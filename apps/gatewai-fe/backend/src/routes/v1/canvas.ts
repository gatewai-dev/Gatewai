import { logger } from "@gatewai/core";
import {
	agentBulkUpdateSchema,
	type BulkUpdatePayload,
	bulkUpdateSchema,
	processSchema,
} from "@gatewai/core/types";
import { applyCanvasUpdate, GetCanvasEntities } from "@gatewai/data-ops";
import { prisma } from "@gatewai/db";
import { NodeWFProcessor } from "@gatewai/graph-engine";
import { zValidator } from "@hono/zod-validator";
import type { XYPosition } from "@xyflow/react";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import z from "zod";
import { AgentRunnerManager } from "../../agent/runner/runner-manager.js";
import type { AuthHonoTypes } from "../../auth.js";
import { redisSubscriber } from "../../lib/redis.js";
import { assertIsError } from "../../utils/misc.js";
import {
	assertCanvasOwnership,
	isApiKeyAuth,
	requireUser,
} from "./auth-helpers.js";

const createPatchQuerySchema = z.object({
	agentSessionId: z.string().optional(),
});

const canvasRoutes = new Hono<{ Variables: AuthHonoTypes }>({
	strict: false,
})
	.get(
		"/",
		zValidator(
			"query",
			z.object({
				q: z.string().optional(),
			}),
		),
		async (c) => {
			const { q } = c.req.valid("query");

			// API key auth (service account) gets all non-API canvases
			if (isApiKeyAuth(c)) {
				const canvases = await prisma.canvas.findMany({
					where: {
						isAPICanvas: false,
						...(q
							? {
									name: {
										contains: q,
										mode: "insensitive",
									},
								}
							: {}),
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
			}

			const user = requireUser(c);

			// Get owned canvases
			const ownedCanvases = await prisma.canvas.findMany({
				where: {
					userId: user.id,
					isAPICanvas: false,
					...(q
						? {
								name: {
									contains: q,
									mode: "insensitive",
								},
							}
						: {}),
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

			return c.json(ownedCanvases);
		},
	)
	.post("/", async (c) => {
		// API key auth creates canvas without owner
		if (isApiKeyAuth(c)) {
			const canvasCount = await prisma.canvas.count();
			const canvas = await prisma.canvas.create({
				data: {
					name: `Canvas ${canvasCount + 1}`,
					// userId is null for service account created canvases
				},
			});
			return c.json(canvas, 201);
		}

		const user = requireUser(c);
		const canvasCount = await prisma.canvas.count({
			where: { userId: user.id },
		});
		const canvas = await prisma.canvas.create({
			data: {
				name: `Canvas ${canvasCount + 1}`,
				userId: user.id,
			},
		});

		return c.json(canvas, 201);
	})
	.get("/:id", async (c) => {
		const id = c.req.param("id");
		// Validate user has access (owner)
		await assertCanvasOwnership(c, id);
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

			// Only owners can rename
			await assertCanvasOwnership(c, id);

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

		// Only owners can update canvas
		await assertCanvasOwnership(c, id);

		console.log("PATCH Canvas Request:", {
			id,
			validated,
			contentType: c.req.header("content-type"),
			hasNodes: !!validated.nodes,
			nodesCount: validated.nodes?.length,
			hasEdges: !!validated.edges,
			hasHandles: !!validated.handles,
		});

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
	.post(
		"/:id/patches",
		zValidator("json", agentBulkUpdateSchema),
		zValidator("query", createPatchQuerySchema),
		async (c) => {
			const id = c.req.param("id");
			// Validate permission: Owner access required to propose patch
			// (Agents using API key will bypass this due to auth-helpers change)
			await assertCanvasOwnership(c, id);

			try {
				const { agentSessionId } = c.req.valid("query");
				const validated = c.req.valid("json");

				const patch = await prisma.canvasPatch.create({
					data: {
						canvasId: id,
						patch: validated as object,
						status: "PENDING",
						agentSessionId: agentSessionId,
					},
				});

				if (agentSessionId) {
					await prisma.event.create({
						data: {
							agentSessionId: agentSessionId,
							eventType: "patch_proposed",
							role: "ASSISTANT",
							content: {
								patchId: patch.id,
								text: "Assistant proposed changes to the canvas.",
							},
						},
					});
				}

				// Notify via session
				if (agentSessionId) {
					const session = await prisma.agentSession.findUnique({
						where: { id: agentSessionId },
					});
					if (session) {
						const { loadSession } = await import(
							"../../agent/session/gatewai-session.js"
						);
						const agentSession = await loadSession(agentSessionId);
						if (agentSession) {
							await agentSession.notifyPatch(patch.id);
						}
					}
				}

				return c.json(patch, 201);
			} catch (error) {
				logger.error(error);
				throw error;
			}
		},
	)
	.post("/:id/patches/:patchId/apply", async (c) => {
		const id = c.req.param("id");
		const patchId = c.req.param("patchId");

		// Validate permission: Owner access required to apply patch
		await assertCanvasOwnership(c, id);

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

		// Validate permission: Owner access required to reject patch
		await assertCanvasOwnership(c, id);

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

		// Validate permission: Owner access required to view patch
		await assertCanvasOwnership(c, id);

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

		// Only owners can delete canvases
		await assertCanvasOwnership(c, id);

		// 1. Find all agent sessions for this canvas
		const sessions = await prisma.agentSession.findMany({
			where: { canvasId: id },
			select: { id: true },
		});

		// 2. Stop all running agents in memory
		for (const session of sessions) {
			AgentRunnerManager.stop(session.id);
		}

		// 3. Delete the canvas (cascades to sessions, nodes, etc.)
		await prisma.canvas.delete({ where: { id } });
		return c.json({ success: true });
	})
	.post("/:id/duplicate", async (c) => {
		const id = c.req.param("id");
		const user = requireUser(c);

		// User needs access to duplicate
		await assertCanvasOwnership(c, id);

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

		// Duplicate belongs to the current user
		const duplicate = await prisma.canvas.create({
			data: { name: `${original.name} (Copy)`, userId: user.id },
		});

		const nodeCreations = original.nodes.map((node) =>
			prisma.node.create({
				data: {
					name: node.name,
					type: node.type,
					position: node.position as XYPosition,
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

		return c.json({ canvas: { ...duplicate, nodes: newNodes } }, 201);
	})
	.post("/:id/process", zValidator("json", processSchema), async (c) => {
		const canvasId = c.req.param("id");
		const validated = c.req.valid("json");
		const user = c.get("user");
		console.log({ payload: c.req.raw.body });
		let apiKey = c.req.header("x-api-key");
		if (!apiKey && user) {
			const userKey = await prisma.apiKey.findFirst({
				where: { userId: user.id },
				orderBy: { createdAt: "asc" },
			});
			if (userKey) {
				apiKey = userKey.key;
			}
		}

		const wfProcessor = new NodeWFProcessor(prisma);
		console.log({ canvasId, validated, apiKey });
		const taskBatch = await wfProcessor.processNodes(
			canvasId,
			validated.node_ids,
			apiKey,
		);

		return c.json(taskBatch, 201);
	})
	.get("/:id/agent/sessions", async (c) => {
		const canvasId = c.req.param("id");
		const agentSessions = await prisma.agentSession.findMany({
			where: { canvasId },
			orderBy: { createdAt: "desc" },
			include: {
				events: {
					where: { role: "USER" },
					orderBy: { createdAt: "asc" },
					take: 1,
				},
			},
		});

		const extractText = (content: any): string => {
			if (!content) return "";
			if (typeof content === "string") return content;
			const rawContent =
				content.content !== undefined ? content.content : content;
			if (typeof rawContent === "string") return rawContent;
			if (Array.isArray(rawContent)) {
				return rawContent.map((item: any) => item.text || "").join("\n");
			}
			if (typeof rawContent === "object" && rawContent !== null) {
				return rawContent.text || JSON.stringify(rawContent);
			}
			return "";
		};

		const sessionsWithPreview = agentSessions.map((session) => ({
			...session,
			preview: session.events[0]
				? extractText(session.events[0].content)
				: "New Chat",
		}));

		return c.json(sessionsWithPreview);
	})
	.post("/:id/agent/sessions", async (c) => {
		const canvasId = c.req.param("id");

		// 1. Check for an existing session on this canvas that has no events
		const existingEmptySession = await prisma.agentSession.findFirst({
			where: {
				canvasId,
				events: {
					none: {},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		// 2. If found, return the existing session
		if (existingEmptySession) {
			return c.json(existingEmptySession, 200);
		}

		// 3. Otherwise, create a new one
		const session = await prisma.agentSession.create({
			data: {
				canvasId,
				status: "COMPLETED",
			},
		});

		return c.json(session, 201);
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

			// 1. Ensure Session exists and is ACTIVE
			await prisma.agentSession.upsert({
				where: { id: sessionId },
				update: {
					status: "ACTIVE",
				},
				create: {
					id: sessionId,
					canvasId: canvasId,
					status: "ACTIVE",
				},
			});

			// 2. Return SSE Stream
			c.header("X-Accel-Buffering", "no");
			c.header("Cache-Control", "no-cache");
			c.header("Content-Type", "text/event-stream");
			c.header("Connection", "keep-alive");

			// Capture Auth Headers to forward to the agent
			const authHeaders: Record<string, string> = {};
			const cookieHeader = c.req.header("cookie");
			if (cookieHeader) authHeaders["cookie"] = cookieHeader;

			const apiKeyHeader = c.req.header("x-api-key");
			if (apiKeyHeader) authHeaders["x-api-key"] = apiKeyHeader;

			const authHeader = c.req.header("authorization");
			if (authHeader) authHeaders["authorization"] = authHeader;

			// [NEW] Explicitly fetch User's Default API Key if available
			// This ensures the Agent uses a stable API Key identity even if the request came via Cookie
			const user = c.get("user");
			if (user && !apiKeyHeader) {
				const userKey = await prisma.apiKey.findFirst({
					where: { userId: user.id },
					orderBy: { createdAt: "asc" }, // Assuming the first key created is the default one
				});

				if (userKey) {
					authHeaders["x-api-key"] = userKey.key;
				}
			}
			console.log("Auth headers:", authHeaders);
			// Start the agent runner in the background
			const started = await AgentRunnerManager.start({
				canvasId,
				sessionId,
				message,
				model,
				authHeaders,
			});

			if (!started) {
				throw new HTTPException(409, {
					message: "Agent is currently busy with another request.",
				});
			}

			return streamSSE(c, async (stream) => {
				const channel = `agent:session:${sessionId}`;
				const subscriber = redisSubscriber.duplicate(); // Use a duplicate connection for subscription

				await subscriber.subscribe(channel);

				let isDone = false;
				const onMessage = async (chan: string, msg: string) => {
					if (chan === channel) {
						await stream.writeSSE({
							data: msg,
						});

						try {
							const event = JSON.parse(msg);
							if (event.type === "done" || event.type === "error") {
								isDone = true;
							}
						} catch (e) {
							// Ignore parse errors
						}
					}
				};

				subscriber.on("message", onMessage);

				// Keep the stream open until the client disconnects or agent finishes
				while (!isDone) {
					await new Promise((resolve) => setTimeout(resolve, 500));
					if (c.req.raw.signal.aborted) {
						break;
					}
				}

				await subscriber.unsubscribe(channel);
				await subscriber.quit();
			});
		},
	)
	.post("/:id/agent/:sessionId/stop", async (c) => {
		const sessionId = c.req.param("sessionId");
		const stopped = await AgentRunnerManager.stop(sessionId);
		return c.json({ success: stopped });
	})
	.get("/:id/agent/:sessionId/stream", async (c) => {
		const sessionId = c.req.param("sessionId");

		c.header("X-Accel-Buffering", "no");
		c.header("Cache-Control", "no-cache");
		c.header("Content-Type", "text/event-stream");

		return streamSSE(c, async (stream) => {
			const channel = `agent:session:${sessionId}`;
			const subscriber = redisSubscriber.duplicate();

			await subscriber.subscribe(channel);

			let isDone = false;
			const onMessage = async (chan: string, msg: string) => {
				if (chan === channel) {
					await stream.writeSSE({
						data: msg,
					});

					try {
						const event = JSON.parse(msg);
						if (event.type === "done" || event.type === "error") {
							isDone = true;
						}
					} catch (e) {
						// Ignore parse errors
					}
				}
			};

			subscriber.on("message", onMessage);

			while (!isDone) {
				await new Promise((resolve) => setTimeout(resolve, 500));
				if (c.req.raw.signal.aborted) {
					break;
				}
			}

			await subscriber.unsubscribe(channel);
			await subscriber.quit();
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

		const extractText = (content: any): string => {
			if (!content) return "";
			if (typeof content === "string") return content;

			// Handle the structure { content: ... }
			const rawContent =
				content.content !== undefined ? content.content : content;

			if (typeof rawContent === "string") return rawContent;
			if (Array.isArray(rawContent)) {
				return rawContent.map((item: any) => item.text || "").join("\n");
			}
			if (typeof rawContent === "object" && rawContent !== null) {
				// Don't show raw function calls or function call results as text
				if (
					rawContent.type === "function_call" ||
					rawContent.type === "function_call_result"
				) {
					return "";
				}
				return rawContent.text || JSON.stringify(rawContent);
			}
			return "";
		};

		// Fetch all patches for this session to get their statuses
		const patches = await prisma.canvasPatch.findMany({
			where: { agentSessionId: sessionId },
			select: { id: true, status: true },
		});
		const patchStatusMap = new Map(patches.map((p) => [p.id, p.status]));

		// Map events to ChatMessage format
		const messages = session.events
			.filter((e) => e.role === "USER" || e.role === "ASSISTANT")
			.map((e) => {
				const content = e.content as any;
				const patchId = content?.patchId;
				return {
					id: e.id,
					role: e.role === "USER" ? "user" : "model",
					text: extractText(content),
					eventType: e.eventType,
					patchId,
					patchStatus: patchId ? patchStatusMap.get(patchId) : undefined,
					createdAt: e.createdAt,
				};
			});

		// If session is active, check for live accumulated text from runner
		if (session.status === "ACTIVE") {
			const liveText = await AgentRunnerManager.getAccumulatedText(sessionId);
			if (liveText !== null) {
				messages.push({
					id: `live-${sessionId}`,
					role: "model",
					text: liveText,
					eventType: "message",
					patchId: undefined,
					createdAt: new Date(),
					isStreaming: true,
				} as any);
			}
		}

		return c.json({ ...session, messages });
	});

export { canvasRoutes };
