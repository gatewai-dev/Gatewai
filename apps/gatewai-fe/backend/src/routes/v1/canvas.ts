import { type NodeUpdateInput, prisma } from "@gatewai/db";
import type { NodeResult } from "@gatewai/types";
import { zValidator } from "@hono/zod-validator";
import type { XYPosition } from "@xyflow/react";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { GetCanvasEntities } from "../../data-ops/canvas.js";
import { NodeWFProcessor } from "../../tasks/canvas-workflow-processor.js";

const NodeTypes = [
	"Text",
	"TextMerger",
	"Preview",
	"File",
	"Export",
	"Toggle",
	"Resize",
	"Paint",
	"Blur",
	"Compositor",
	"Note",
	"Number",
	"ImageGen",
	"LLM",
	"Crop",
	"Modulate",
	"Preview",
	"VideoGen",
	"VideoGenFirstLastFrame",
	"VideoGenExtend",
	"TextToSpeech",
	"SpeechToText",
	"VideoCompositor",
] as const;

const DataTypes = [
	"Text",
	"Number",
	"Boolean",
	"Image",
	"Video",
	"Audio",
] as const;

const handleSchema = z.object({
	id: z.string().optional(),
	type: z.enum(["Input", "Output"]),
	dataTypes: z.array(z.enum(DataTypes)),
	label: z.string(),
	order: z.number().default(0),
	required: z.boolean().default(false),
	templateHandleId: z.string().optional().nullable(),
	nodeId: z.string(),
});

const nodeSchema = z.object({
	id: z.string().optional(),
	name: z.string(),
	type: z.enum(NodeTypes),
	position: z.object({
		x: z.number(),
		y: z.number(),
	}),
	handles: z.array(handleSchema).optional(),
	width: z.number().optional(),
	height: z.number().optional().nullable(),
	draggable: z.boolean().optional().default(true),
	selectable: z.boolean().optional().default(true),
	deletable: z.boolean().optional().default(true),
	result: z.any().optional(),
	config: z.any().optional(),
	isDirty: z.boolean().optional().default(false),
	zIndex: z.number().optional(),
	templateId: z.string(),
});

const edgeSchema = z.object({
	id: z.string().optional(),
	source: z.string(),
	target: z.string(),
	sourceHandleId: z.string().optional(),
	targetHandleId: z.string().optional(),
});

const processSchema = z.object({
	node_ids: z.array(z.string()).optional(),
});

const bulkUpdateSchema = z.object({
	name: z.string().min(1).max(20).optional(),
	nodes: z.array(nodeSchema).optional(),
	edges: z.array(edgeSchema).optional(),
	handles: z.array(handleSchema).optional(),
});

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

		// --- 1. Fetch Existing Entities ---
		const nodesInDB = await prisma.node.findMany({
			where: { canvasId: id },
			select: { id: true },
		});
		const nodeIdsInDBSet = new Set(nodesInDB.map((m) => m.id));

		const edgesInDB = await prisma.edge.findMany({
			where: {
				OR: [
					{ targetNode: { canvasId: id } },
					{ sourceNode: { canvasId: id } },
				],
			},
			select: { id: true },
		});
		const edgeIdsInDBSet = new Set(edgesInDB.map((m) => m.id));

		const handlesInDB = await prisma.handle.findMany({
			where: {
				node: { canvasId: id },
			},
			select: { id: true },
		});
		const handleIdsInDBSet = new Set(handlesInDB.map((m) => m.id));

		// --- 2. Prepare Payload Data ---
		const nodesInPayload = validated.nodes ?? [];
		const edgesInPayload = validated.edges ?? [];
		const handlesInPayload = validated.handles ?? [];

		const nodeIdsInPayloadSet = new Set(
			nodesInPayload.map((m) => m.id).filter((id): id is string => !!id),
		);
		const edgeIdsInPayloadSet = new Set(
			edgesInPayload.map((m) => m.id).filter((id): id is string => !!id),
		);
		const handleIdsInPayloadSet = new Set(
			handlesInPayload.map((m) => m.id).filter((id): id is string => !!id),
		);

		// --- 3. Determine Deletions ---
		const removedNodeIds = Array.from(nodeIdsInDBSet).filter(
			(id) => !nodeIdsInPayloadSet.has(id),
		);
		const removedEdgeIds = Array.from(edgeIdsInDBSet).filter(
			(id) => !edgeIdsInPayloadSet.has(id),
		);
		const removedHandleIds = Array.from(handleIdsInDBSet).filter(
			(id) => !handleIdsInPayloadSet.has(id),
		);

		// --- 4. Begin Transaction Construction ---
		// Explicitly type the transaction array to allow mixed return types (BatchPayload vs Node/Edge objects)
		const txs = [];

		// Delete Edges first to avoid FK constraints
		if (removedEdgeIds.length > 0) {
			txs.push(
				prisma.edge.deleteMany({
					where: { id: { in: removedEdgeIds } },
				}),
			);
		}

		if (removedHandleIds.length > 0) {
			txs.push(
				prisma.handle.deleteMany({
					where: { id: { in: removedHandleIds } },
				}),
			);
		}

		if (removedNodeIds.length > 0) {
			txs.push(
				prisma.node.deleteMany({
					where: { id: { in: removedNodeIds } },
				}),
			);
		}

		// Canvas name update
		if (validated.name) {
			txs.push(
				prisma.canvas.update({
					where: { id },
					data: { name: validated.name },
				}),
			);
		}

		// --- 5. Node Operations ---
		const createdNodes = nodesInPayload.filter(
			(n): n is typeof n & { id: string } =>
				!!n.id && !nodeIdsInDBSet.has(n.id),
		);
		const updatedNodes = nodesInPayload.filter(
			(n): n is typeof n & { id: string } => !!n.id && nodeIdsInDBSet.has(n.id),
		);

		if (createdNodes.length > 0) {
			txs.push(
				prisma.node.createMany({
					data: createdNodes.map((newNode) => ({
						id: newNode.id,
						result: newNode.result,
						config: newNode.config,
						name: newNode.name,
						width: newNode.width,
						height: newNode.height,
						type: newNode.type,
						templateId: newNode.templateId,
						position: newNode.position,
						canvasId: id,
					})),
				}),
			);
		}

		// Fetch templates for validation
		const updatedNodeTemplateIds = updatedNodes
			.map((m) => m.templateId)
			.filter((id): id is string => !!id);

		const updatedNodeTemplates = await prisma.nodeTemplate.findMany({
			where: { id: { in: updatedNodeTemplateIds } },
		});

		const isTerminalNode = (templateId: string) => {
			const nodeTemplate = updatedNodeTemplates.find(
				(f) => f.id === templateId,
			);
			// Defensive: if template missing, safe default
			return nodeTemplate ? nodeTemplate.isTerminalNode : false;
		};

		updatedNodes.forEach((uNode) => {
			const updateData: NodeUpdateInput = {
				config: uNode.config,
				position: uNode.position,
				name: uNode.name,
			};

			if (!isTerminalNode(uNode.templateId)) {
				updateData.result = uNode.result;
			}

			if (uNode.result) {
				updateData.result = {
					selectedOutputIndex: uNode.result?.selectedOutputIndex,
					outputs: (uNode.result as NodeResult).outputs,
				} as NodeResult;
			}

			txs.push(
				prisma.node.update({
					data: updateData,
					where: { id: uNode.id },
				}),
			);
		});

		const validNodeIdsSet = new Set([
			...Array.from(nodeIdsInDBSet).filter(
				(id) => !removedNodeIds.includes(id),
			),
			...createdNodes.map((n) => n.id),
		]);

		const rawCreatedHandles = handlesInPayload.filter(
			(h): h is typeof h & { id: string } =>
				!!h.id && !handleIdsInDBSet.has(h.id),
		);

		// Filter out handles that point to non-existent nodes
		const safeCreatedHandles = rawCreatedHandles.filter((h) => {
			if (!validNodeIdsSet.has(h.nodeId)) {
				console.warn(
					`Skipping handle creation for invalid nodeId: ${h.nodeId}`,
				);
				return false;
			}
			return true;
		});

		const updatedHandles = handlesInPayload.filter(
			(h): h is typeof h & { id: string } =>
				!!h.id && handleIdsInDBSet.has(h.id),
		);

		if (safeCreatedHandles.length > 0) {
			txs.push(
				prisma.handle.createMany({
					data: safeCreatedHandles.map((nHandle) => ({
						id: nHandle.id,
						nodeId: nHandle.nodeId,
						required: nHandle.required,
						dataTypes: nHandle.dataTypes,
						label: nHandle.label,
						order: nHandle.order,
						templateHandleId: nHandle.templateHandleId,
						type: nHandle.type,
					})),
				}),
			);
		}

		updatedHandles.forEach((uHandle) => {
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

		// --- 7. Edge Operations ---
		// Edges also depend on valid handles. We'll verify source/target nodes first.
		const rawCreatedEdges = edgesInPayload.filter(
			(
				e,
			): e is typeof e & {
				id: string;
				sourceHandleId: string;
				targetHandleId: string;
			} =>
				!!e.id &&
				!!e.sourceHandleId &&
				!!e.targetHandleId &&
				!edgeIdsInDBSet.has(e.id),
		);

		const safeCreatedEdges = rawCreatedEdges.filter((e) => {
			if (!validNodeIdsSet.has(e.source) || !validNodeIdsSet.has(e.target)) {
				console.warn(
					`Skipping edge creation for invalid nodes: ${e.source} -> ${e.target}`,
				);
				return false;
			}
			return true;
		});

		const updatedEdges = edgesInPayload.filter(
			(
				e,
			): e is typeof e & {
				id: string;
				sourceHandleId: string;
				targetHandleId: string;
			} =>
				!!e.id &&
				!!e.sourceHandleId &&
				!!e.targetHandleId &&
				edgeIdsInDBSet.has(e.id),
		);

		if (safeCreatedEdges.length > 0) {
			txs.push(
				prisma.edge.createMany({
					data: safeCreatedEdges.map((newEdge) => ({
						id: newEdge.id,
						source: newEdge.source,
						sourceHandleId: newEdge.sourceHandleId,
						target: newEdge.target,
						targetHandleId: newEdge.targetHandleId,
					})),
				}),
			);
		}

		updatedEdges.forEach((uEdge) => {
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

		// Execute all transactions atomically
		await prisma.$transaction(txs);

		// --- Return Response ---
		const canvas = await prisma.canvas.findFirst({
			where: { id },
		});

		if (!canvas) {
			throw new HTTPException(404, { message: "Canvas not found" });
		}

		const nodes = await prisma.node.findMany({
			where: { canvasId: id },
			include: { template: true },
		});

		const edges = await prisma.edge.findMany({
			where: { sourceNode: { canvasId: id } },
		});

		const handles = await prisma.handle.findMany({
			where: { nodeId: { in: nodes.map((m) => m.id) } },
		});

		return c.json({
			canvas,
			edges,
			nodes,
			handles,
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

		// We use $transaction with an array of PrismaPromises which return Nodes.
		// Since we map strictly 1:1, we can rely on index matching for the map construction below.
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
		// Map to store temporary mapping logic
		const tempHandleMapping: { oldId: string; newNodeId: string }[] = [];

		for (let i = 0; i < original.nodes.length; i++) {
			const oldNode = original.nodes[i];
			const newNodeId = newNodes[i].id;
			for (const oldHandle of oldNode.handles) {
				tempHandleMapping.push({
					oldId: oldHandle.id,
					newNodeId: newNodeId, // store for reference if needed
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
				if (!hasHandleIds) {
					return null;
				}
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
	});

export { canvasRoutes };
