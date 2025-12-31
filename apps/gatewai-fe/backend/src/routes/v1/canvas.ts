import {
	type Handle,
	type NodeUpdateArgs,
	type NodeUpdateInput,
	prisma,
} from "@gatewai/db";
import { zValidator } from "@hono/zod-validator";
import type { XYPosition } from "@xyflow/react";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import type { AuthHonoTypes } from "../../auth.js";
import { GetCanvasEntities } from "../../repositories/canvas.js";
import { NodeWFProcessor } from "../../tasks/node.js";

const NodeTypes = [
	"Text",
	"Preview",
	"File",
	"Export",
	"Toggle",
	"Crawler",
	"Resize",
	"Agent",
	"ThreeD",
	"Paint",
	"Blur",
	"Compositor",
	"Describer",
	"Router",
	"Note",
	"Number",
	"ImageGen",
	"LLM",
	"Crop",
] as const;

const DataTypes = [
	"Text",
	"Number",
	"Boolean",
	"Image",
	"Video",
	"Audio",
	"File",
	"Mask",
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
	node_ids: z.array(z.string()).min(1),
});

const bulkUpdateSchema = z.object({
	name: z.string().min(1).max(20).optional(),
	nodes: z.array(nodeSchema).optional(),
	edges: z.array(edgeSchema).optional(),
	handles: z.array(handleSchema).optional(),
});

const canvasRoutes = new Hono<{ Variables: AuthHonoTypes }>({
	strict: false,
})
	.get("/", async (c) => {
		const user = c.get("user");
		if (!user) {
			throw new HTTPException(401, { message: "Unauthorized" });
		}

		const canvases = await prisma.canvas.findMany({
			where: {
				userId: user.id,
			},
			orderBy: {
				updatedAt: "desc",
			},
			select: {
				id: true,
				name: true,
				createdAt: true,
				updatedAt: true,
				userId: true,
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
		const user = c.get("user");
		if (!user) {
			throw new HTTPException(401, { message: "Unauthorized" });
		}

		const canvasCount = await prisma.canvas.count({
			where: {
				userId: user.id,
			},
		});

		const canvas = await prisma.canvas.create({
			data: {
				userId: user.id,
				name: `Canvas ${canvasCount + 1}`,
			},
		});

		return c.json(canvas, 201);
	})
	.get("/:id", async (c) => {
		const id = c.req.param("id");
		const user = c.get("user");
		if (!user) {
			throw new HTTPException(401, { message: "User not found" });
		}

		const response = await GetCanvasEntities(id, user);

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
			const user = c.get("user");
			const validated = c.req.valid("json");
			const id = c.req.param("id");
			if (!user) {
				throw new HTTPException(401, { message: "Unauthorized" });
			}

			const canvas = await prisma.canvas.update({
				where: {
					id,
				},
				data: {
					name: validated.name,
				},
			});

			return c.json(canvas, 201);
		},
	)
	.patch("/:id", zValidator("json", bulkUpdateSchema), async (c) => {
		// Step 1: Validate input and fetch user/canvas
		const id = c.req.param("id");
		const validated = c.req.valid("json");
		const user = c.get("user");
		if (!user) {
			throw new HTTPException(401, { message: "Unauthorized" });
		}

		const existingCanvas = await prisma.canvas.findFirst({
			where: { id, userId: user.id },
		});

		if (!existingCanvas) {
			throw new HTTPException(404, { message: "Canvas not found" });
		}

		// Get canvas entities from DB
		const nodesInDB = await prisma.node.findMany({
			where: {
				canvasId: id,
			},
		});
		const nodeIdsInDB = nodesInDB.map((m) => m.id);

		const edgesInDB = await prisma.edge.findMany({
			where: {
				OR: [
					{
						targetNode: {
							id: {
								in: nodeIdsInDB,
							},
						},
					},
					{
						sourceNode: {
							id: {
								in: nodeIdsInDB,
							},
						},
					},
				],
			},
		});
		const edgeIdsInDB = edgesInDB.map((m) => m.id);

		const handlesInDB = await prisma.handle.findMany({
			where: {
				nodeId: {
					in: nodeIdsInDB,
				},
			},
		});
		const handleIdsInDB = handlesInDB.map((m) => m.id);

		// Prepare payload data
		const nodesInPayload = validated.nodes ?? [];
		const edgesInPayload = validated.edges ?? [];
		const handlesInPayload = validated.handles ?? [];

		const nodeIdsInPayload = nodesInPayload
			.map((m) => m.id)
			.filter((id): id is string => !!id);

		const edgeIdsInPayload = edgesInPayload
			.map((m) => m.id)
			.filter((id): id is string => !!id);

		const handleIdsInPayload = handlesInPayload
			.map((m) => m.id)
			.filter((id): id is string => !!id);

		// Deletions
		const removedNodeIds = nodeIdsInDB.filter(
			(id) => !nodeIdsInPayload.includes(id),
		);
		const removedEdgeIds = edgeIdsInDB.filter(
			(id) => !edgeIdsInPayload.includes(id),
		);
		const removedHandleIds = handleIdsInDB.filter(
			(id) => !handleIdsInPayload.includes(id),
		);

		const deleteEdgesTx = prisma.edge.deleteMany({
			where: {
				id: {
					in: removedEdgeIds,
				},
			},
		});

		const deleteHandlesTx = prisma.handle.deleteMany({
			where: {
				id: {
					in: removedHandleIds,
				},
			},
		});

		const deleteNodesTx = prisma.node.deleteMany({
			where: {
				id: {
					in: removedNodeIds,
				},
			},
		});

		const txs = [deleteEdgesTx, deleteHandlesTx, deleteNodesTx];

		// Canvas name update if provided
		if (validated.name) {
			const updateCanvasTx = prisma.canvas.update({
				where: { id },
				data: { name: validated.name },
			});
			txs.push(updateCanvasTx);
		}

		// Node creations and updates
		const createdNodes = nodesInPayload.filter(
			(n): n is typeof n & { id: string } =>
				!!n.id && !nodeIdsInDB.includes(n.id),
		);
		const updatedNodes = nodesInPayload.filter(
			(n): n is typeof n & { id: string } =>
				!!n.id && nodeIdsInDB.includes(n.id),
		);

		const createNodesTx = prisma.node.createMany({
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
		});
		txs.push(createNodesTx);

		const updatedNodeTemplateIds = updatedNodes
			.map((m) => m.templateId)
			.filter((id): id is string => !!id);

		const updatedNodeTemplates = await prisma.nodeTemplate.findMany({
			where: {
				id: {
					in: updatedNodeTemplateIds,
				},
			},
		});

		const isTerminalNode = (templateId: string) => {
			const nodeTemplate = updatedNodeTemplates.find(
				(f) => f.id === templateId,
			);
			if (!nodeTemplate) {
				throw new Error("Node template not found for node");
			}
			return nodeTemplate.isTerminalNode;
		};

		const updatedNodesTxs = updatedNodes.map((uNode) => {
			const updateData: NodeUpdateInput = {
				config: uNode.config,
				position: uNode.position,
				name: uNode.name,
			};
			if (!isTerminalNode(uNode.templateId)) {
				updateData.result = uNode.result;
			}
			return prisma.node.update({
				data: updateData,
				where: {
					id: uNode.id,
				},
			});
		});
		txs.push(...updatedNodesTxs);

		// Handle creations and updates
		const createdHandles = handlesInPayload.filter(
			(h): h is typeof h & { id: string } =>
				!!h.id && !handleIdsInDB.includes(h.id),
		);
		const updatedHandles = handlesInPayload.filter(
			(h): h is typeof h & { id: string } =>
				!!h.id && handleIdsInDB.includes(h.id),
		);

		const createHandlesTx = prisma.handle.createMany({
			data: createdHandles.map((nHandle) => ({
				id: nHandle.id,
				nodeId: nHandle.nodeId,
				required: nHandle.required,
				dataTypes: nHandle.dataTypes,
				label: nHandle.label,
				order: nHandle.order,
				templateHandleId: nHandle.templateHandleId,
				type: nHandle.type,
			})),
		});
		txs.push(createHandlesTx);

		const updatedHandlesTxs = updatedHandles.map((uHandle) =>
			prisma.handle.update({
				data: {
					type: uHandle.type,
					dataTypes: uHandle.dataTypes,
					label: uHandle.label,
					order: uHandle.order,
					required: uHandle.required,
					templateHandleId: uHandle.templateHandleId,
				},
				where: {
					id: uHandle.id,
				},
			}),
		);
		txs.push(...updatedHandlesTxs);

		// Edge creations and updates
		const createdEdges = edgesInPayload.filter(
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
				!edgeIdsInDB.includes(e.id),
		);
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
				edgeIdsInDB.includes(e.id),
		);

		const createEdgesTx = prisma.edge.createMany({
			data: createdEdges.map((newEdge) => ({
				id: newEdge.id,
				source: newEdge.source,
				sourceHandleId: newEdge.sourceHandleId,
				target: newEdge.target,
				targetHandleId: newEdge.targetHandleId,
			})),
		});
		txs.push(createEdgesTx);

		const updatedEdgesTxs = updatedEdges.map((uEdge) =>
			prisma.edge.update({
				data: {
					source: uEdge.source,
					sourceHandleId: uEdge.sourceHandleId,
					target: uEdge.target,
					targetHandleId: uEdge.targetHandleId,
				},
				where: {
					id: uEdge.id,
				},
			}),
		);
		txs.push(...updatedEdgesTxs);

		// Execute all transactions atomically
		await prisma.$transaction(txs);

		// Fetch updated entities
		const canvas = await prisma.canvas.findFirst({
			where: {
				id,
				userId: user?.id, // Ensure user owns the canvas
			},
		});

		const nodes = await prisma.node.findMany({
			where: {
				canvasId: canvas?.id,
			},
			include: {
				template: true,
			},
		});

		if (!canvas) {
			throw new HTTPException(404, { message: "Canvas not found" });
		}

		// Get all edges for this canvas separately for cleaner structure
		const edges = await prisma.edge.findMany({
			where: {
				sourceNode: {
					canvasId: id,
				},
			},
		});

		const handles = await prisma.handle.findMany({
			where: {
				nodeId: {
					in: nodes.map((m) => m.id),
				},
			},
		});

		return c.json({
			canvas: canvas,
			edges,
			nodes,
			handles,
		});
	})
	.delete("/:id", async (c) => {
		const id = c.req.param("id");
		const user = c.get("user");

		// Verify ownership
		const existing = await prisma.canvas.findFirst({
			where: { id, userId: user?.id },
		});

		if (!existing) {
			throw new HTTPException(404, { message: "Canvas not found" });
		}

		await prisma.canvas.delete({
			where: { id },
		});

		return c.json({ success: true });
	})
	.post("/:id/duplicate", async (c) => {
		const id = c.req.param("id");
		const user = c.get("user");

		if (!user) {
			throw new HTTPException(401, { message: "Unauthorized" });
		}

		// Get the original canvas with all its data
		const original = await prisma.canvas.findFirst({
			where: { id, userId: user.id },
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

		// Get edges separately
		const originalEdges = await prisma.edge.findMany({
			where: {
				sourceNode: {
					canvasId: id,
				},
			},
		});

		// Create the duplicate canvas
		const duplicate = await prisma.canvas.create({
			data: {
				name: `${original.name} (Copy)`,
				userId: user.id,
			},
		});

		// Create new nodes
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

		// Create nodeIdMap
		const nodeIdMap = new Map<string, string>();
		original.nodes.forEach((oldNode, index) => {
			nodeIdMap.set(oldNode.id, newNodes[index].id);
		});

		// Create new handles
		const handleCreations = [];
		for (let i = 0; i < original.nodes.length; i++) {
			const oldNode = original.nodes[i];
			const newNodeId = newNodes[i].id;
			for (const oldHandle of oldNode.handles) {
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

		// Create handleIdMap
		const handleIdMap = new Map<string, string>();
		let handleIndex = 0;
		for (const oldNode of original.nodes) {
			for (const oldHandle of oldNode.handles) {
				handleIdMap.set(oldHandle.id, newHandles[handleIndex].id);
				handleIndex++;
			}
		}

		// Create edges with new node and handle IDs
		const edgeCreations = originalEdges
			.map((edge) => {
				const newSource = nodeIdMap.get(edge.source);
				const newTarget = nodeIdMap.get(edge.target);
				const newSourceHandleId = handleIdMap.get(edge.sourceHandleId);
				const newTargetHandleId = handleIdMap.get(edge.targetHandleId);

				if (
					!newSource ||
					!newTarget ||
					!newSourceHandleId ||
					!newTargetHandleId
				)
					return null;

				return prisma.edge.create({
					data: {
						source: newSource,
						target: newTarget,
						sourceHandleId: newSourceHandleId,
						targetHandleId: newTargetHandleId,
					},
				});
			})
			.filter(Boolean);

		if (edgeCreations.length > 0) {
			await prisma.$transaction(edgeCreations);
		}

		// Return the duplicate canvas with nodes (without re-fetching everything)
		return c.json({ canvas: { ...duplicate, nodes: newNodes } }, 201);
	})
	.post("/:id/process", zValidator("json", processSchema), async (c) => {
		const canvasId = c.req.param("id");
		const validated = c.req.valid("json");
		const user = c.get("user");

		if (!user) {
			throw new HTTPException(401, { message: "User is not found" });
		}

		const wfProcessor = new NodeWFProcessor(prisma);

		// Starts processing but does not await.
		// Frontend starts polling when it get's batch info response.
		const taskBatch = await wfProcessor.processSelectedNodes(
			canvasId,
			validated.node_ids,
			user,
		);

		return c.json(taskBatch, 201);
	})
	.post(
		"/:id/add-fal-node",
		zValidator(
			"json",
			z.object({
				modelUrl: z.string().url().min(1),
				nodeId: z.string(),
			}),
		),
		async (c) => {
			const canvasId = c.req.param("id");
			const validated = c.req.valid("json");
			const user = c.get("user");

			function extractFalModel(url: string): string | null {
				try {
					const { pathname } = new URL(url);

					// Expected: /models/{org}/{model}
					const parts = pathname.split("/").filter(Boolean);

					if (parts.length >= 3 && parts[0] === "models") {
						return `${parts[1]}/${parts[2]}`;
					}

					return null;
				} catch {
					// Invalid URL
					return null;
				}
			}
			const modelName = extractFalModel(validated.modelUrl);
			if (!modelName) {
				throw new HTTPException(400, { message: "Invalid model url" });
			}

			if (!user) {
				throw new HTTPException(401, { message: "Unauthorized" });
			}

			const canvas = await prisma.canvas.findFirst({
				where: { id: canvasId, userId: user.id },
			});

			if (!canvas) {
				throw new HTTPException(404, { message: "Canvas not found" });
			}

			const apiUrl = `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${modelName}`;
			const apiResponse = await fetch(apiUrl);

			if (!apiResponse.ok) {
				throw new HTTPException(400, {
					message: "Failed to fetch OpenAPI schema",
				});
			}

			const openapi: any = await apiResponse.json();

			const modelPath = `/${modelName}`;
			if (!openapi.paths[modelPath] || !openapi.paths[modelPath].post) {
				throw new HTTPException(400, { message: "Invalid model schema" });
			}

			const inputRef =
				openapi.paths[modelPath].post.requestBody.content["application/json"]
					.schema.$ref;
			const inputName = inputRef.split("/").pop();
			const inputSchema = openapi.components.schemas[inputName];

			if (!inputSchema) {
				throw new HTTPException(400, { message: "Input schema not found" });
			}

			const resultPath = `${modelPath}/requests/{request_id}`;
			if (!openapi.paths[resultPath] || !openapi.paths[resultPath].get) {
				throw new HTTPException(400, { message: "Result schema not found" });
			}

			const outputRef =
				openapi.paths[resultPath].get.responses["200"].content[
					"application/json"
				].schema.$ref;
			const outputName = outputRef.split("/").pop();
			const outputSchema = openapi.components.schemas[outputName];

			if (!outputSchema) {
				throw new HTTPException(400, { message: "Output schema not found" });
			}
			// Update mode
			const node = await prisma.node.findUnique({
				where: { id: validated.nodeId },
				select: { id: true, type: true, canvasId: true },
			});

			if (!node || node.canvasId !== canvasId) {
				throw new HTTPException(404, { message: "Node not found" });
			}

			if (node.type !== "Fal") {
				throw new HTTPException(400, { message: "Node is not a Fal node" });
			}

			const updateData: NodeUpdateArgs["data"] = {
				name: modelName.split("/").pop() || "Fal Node",
				config: {
					openapi,
					model: modelName,
				},
				isDirty: true,
			};

			await prisma.node.update({
				where: { id: validated.nodeId },
				data: updateData,
				include: {
					template: true,
				},
			});

			const getDataType = (schema: any, allSchemas: any): string[] => {
				if (schema.$ref) {
					const refName = schema.$ref.split("/").pop();
					return getDataType(allSchemas[refName], allSchemas);
				}

				if (schema.anyOf) {
					return getDataType(schema.anyOf[0], allSchemas);
				}

				if (schema.enum) {
					return ["Text"];
				}

				switch (schema.type) {
					case "string":
						return ["Text"];
					case "integer":
					case "number":
						return ["Number"];
					case "boolean":
						return ["Boolean"];
					case "array":
						if (schema.items) {
							const itemTypes = getDataType(schema.items, allSchemas);
							if (itemTypes.includes("Image")) {
								return ["Image"];
							}
						}
						return ["File"];
					case "object":
						if (
							schema.properties?.url &&
							schema.properties?.width &&
							schema.properties?.height
						) {
							return ["Image"];
						}
						return ["File"];
					default:
						return ["Text"];
				}
			};

			const inputOrder =
				inputSchema["x-fal-order-properties"] ||
				Object.keys(inputSchema.properties);
			const inputHandles = inputOrder
				.map((key: string, index: number) => {
					const prop = inputSchema.properties[key];
					if (!prop) return null;
					return {
						type: "Input",
						label: prop.title || key,
						dataTypes: getDataType(prop, openapi.components.schemas),
						required: inputSchema.required?.includes(key) || false,
						order: index,
						nodeId: validated.nodeId,
					} as Handle;
				})
				.filter(Boolean);

			const outputOrder =
				outputSchema["x-fal-order-properties"] ||
				Object.keys(outputSchema.properties);
			const outputHandles = outputOrder
				.map((key: string, index: number) => {
					const prop = outputSchema.properties[key];
					if (!prop) return null;
					return {
						type: "Output",
						label: prop.title || key,
						dataTypes: getDataType(prop, openapi.components.schemas),
						required: false,
						order: index,
						nodeId: validated.nodeId,
					} as Handle;
				})
				.filter(Boolean);

			await prisma.handle.createMany({
				data: [...inputHandles, ...outputHandles],
			});

			const updatedNode = await prisma.node.findFirstOrThrow({
				where: { id: validated.nodeId },
				include: {
					template: true,
				},
			});

			const createdHandles = await prisma.handle.findMany({
				where: {
					nodeId: updatedNode.id,
				},
				include: {
					templateHandle: true,
				},
			});

			return c.json(
				{
					handles: createdHandles,
					node: updatedNode,
				},
				201,
			);
		},
	);

export { canvasRoutes };
