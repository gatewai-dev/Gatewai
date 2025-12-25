import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator'
import z from "zod";
import { HTTPException } from "hono/http-exception";
import { prisma, type NodeUpdateInput } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";
import type { XYPosition } from '@xyflow/react';
import { GetCanvasEntities } from "../../repositories/canvas.js";
import { NodeWFProcessor } from "../../tasks/node.js";

const NodeTypes = [
        'Text', 'Preview', 'File', 'Export',
        'Toggle', 'Crawler', 'Resize', 'Agent', 'ThreeD',
        'Painter', 'Blur', 'Compositor', 'Describer', 'Router',
        'Note', 'Number', 'GPTImage1', 'LLM'
] as const;

const DataTypes = ["Text", "Number","Boolean", "Image", "Video", "Audio", "File", "Mask"] as const

const handleSchema = z.object({
    id: z.string().optional(),
    type: z.enum(['Input', 'Output']),
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

const canvasRoutes = new Hono<{Variables: AuthHonoTypes}>({
    strict: false,
})
.get('/', async (c) => {
    const user = c.get('user');
    if (!user) {
        throw new HTTPException(401, { message: 'Unauthorized' });
    }

    const canvases = await prisma.canvas.findMany({
        where: {
            userId: user.id,
        },
        orderBy: {
            updatedAt: 'desc',
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
                }
            }
        }
    });

    return c.json(canvases);
})
.post('/',
    async (c) => {
        const user = c.get('user');
        if (!user) {
            throw new HTTPException(401, { message: 'Unauthorized' });
        }

        const canvasCount = await prisma.canvas.count({
            where: {
                userId: user.id
            }
        })

        const canvas = await prisma.canvas.create({
            data: {
                userId: user.id,
                name: `Canvas ${canvasCount + 1}`,
            },
        });

        return c.json(canvas, 201);
    }
)
.get('/:id', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    if (!user) {
        throw new HTTPException(401, { message: 'User not found' });
    }

    const response = await GetCanvasEntities(id, user);

    return c.json(response);
})
.patch('/:id/update-name',
    zValidator('json', z.object({
        name: z.string()
    })),
    async (c) => {
        const user = c.get('user');
        const validated = c.req.valid('json');
        const id = c.req.param('id');
        if (!user) {
            throw new HTTPException(401, { message: 'Unauthorized' });
        }

        const canvas = await prisma.canvas.update({
            where: {
                id,
            },
            data: {
                name: validated.name
            }
        });

        return c.json(canvas, 201);
    }
)
.patch('/:id',
    zValidator('json', bulkUpdateSchema),
    async (c) => {
        // Step 1: Validate input and fetch user/canvas
        const id = c.req.param('id');
        const validated = c.req.valid('json');
        const user = c.get('user');
        if (!user) {
            throw new HTTPException(401, { message: 'Unauthorized' });
        }

        const existingCanvas = await prisma.canvas.findFirst({
            where: { id, userId: user.id }
        });

        if (!existingCanvas) {
            throw new HTTPException(404, { message: 'Canvas not found' });
        }

        // Get canvas entities from DB
        const nodesInDB = await prisma.node.findMany({
            where: {
                canvasId: id,
            }
        });
        const nodeIdsInDB = nodesInDB.map(m => m.id);

        const edgesInDB = await prisma.edge.findMany({
            where: {
                OR: [
                    {
                        targetNode: {
                            id: {
                                in: nodeIdsInDB,
                            }
                        },
                    },
                    {
                        sourceNode: {
                            id: {
                                in: nodeIdsInDB,
                            }
                        },
                    }
                ]
            }
        });
        const edgeIdsInDB = edgesInDB.map(m => m.id);

        const handlesInDB = await prisma.handle.findMany({
            where: {
                nodeId: {
                    in: nodeIdsInDB,
                }
            }
        });
        const handleIdsInDB = handlesInDB.map(m => m.id);

        // Prepare payload data
        const nodesInPayload = validated.nodes ?? [];
        const edgesInPayload = validated.edges ?? [];
        const handlesInPayload = validated.handles ?? [];

        const nodeIdsInPayload = nodesInPayload.map(m => m.id).filter(Boolean) as string[];
        const edgeIdsInPayload = edgesInPayload.map(m => m.id).filter(Boolean) as string[];
        const handleIdsInPayload = handlesInPayload.map(m => m.id).filter(Boolean) as string[];

        // Deletions
        const removedNodeIds = nodeIdsInDB.filter(id => !nodeIdsInPayload.includes(id));
        const removedEdgeIds = edgeIdsInDB.filter(id => !edgeIdsInPayload.includes(id));
        const removedHandleIds = handleIdsInDB.filter(id => !handleIdsInPayload.includes(id));

        const deleteEdgesTx = prisma.edge.deleteMany({
            where: {
                id: {
                    in: removedEdgeIds
                }
            }
        });

        const deleteHandlesTx = prisma.handle.deleteMany({
            where: {
                id: {
                    in: removedHandleIds
                }
            }
        });

        const deleteNodesTx = prisma.node.deleteMany({
            where: {
                id: {
                    in: removedNodeIds,
                }
            }
        });

        let txs: any[] = [deleteEdgesTx, deleteHandlesTx, deleteNodesTx];

        // Canvas name update if provided
        let updateCanvasTx;
        if (validated.name) {
            updateCanvasTx = prisma.canvas.update({
                where: { id },
                data: { name: validated.name }
            });
            txs.push(updateCanvasTx);
        }

        // Node creations and updates
        const createdNodes = nodesInPayload.filter(n => n.id && !nodeIdsInDB.includes(n.id));
        const updatedNodes = nodesInPayload.filter(n => n.id && nodeIdsInDB.includes(n.id));

        const createNodesTx = prisma.node.createMany({
            data: createdNodes.map((newNode) => ({
                id: newNode.id!,
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

        const updatedNodeTemplateIds = updatedNodes.map(m => m.templateId).filter(Boolean) as string[];
        const updatedNodeTemplates = await prisma.nodeTemplate.findMany({
            where: {
                id: {
                    in: updatedNodeTemplateIds
                }
            }
        });

        const isTerminalNode = (templateId: string) => {
            const nodeTemplate = updatedNodeTemplates.find(f => f.id === templateId);
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
            if (isTerminalNode(uNode.templateId)) {
                updateData.result = uNode.result;
            }
            return prisma.node.update({
                data: updateData,
                where: {
                    id: uNode.id!,
                }
            });
        });
        txs.push(...updatedNodesTxs);

        // Handle creations and updates
        const createdHandles = handlesInPayload.filter(h => h.id && !handleIdsInDB.includes(h.id));
        const updatedHandles = handlesInPayload.filter(h => h.id && handleIdsInDB.includes(h.id));

        const createHandlesTx = prisma.handle.createMany({
            data: createdHandles.map((nHandle) => ({
                id: nHandle.id!,
                nodeId: nHandle.nodeId,
                required: nHandle.required,
                dataTypes: nHandle.dataTypes,
                label: nHandle.label,
                order: nHandle.order,
                templateHandleId: nHandle.templateHandleId,
                type: nHandle.type
            }))
        });
        txs.push(createHandlesTx);

        const updatedHandlesTxs = updatedHandles.map((uHandle) => prisma.handle.update({
            data: {
                type: uHandle.type,
                dataTypes: uHandle.dataTypes,
                label: uHandle.label,
                order: uHandle.order,
                required: uHandle.required,
                templateHandleId: uHandle.templateHandleId,
            },
            where: {
                id: uHandle.id!,
            }
        }));
        txs.push(...updatedHandlesTxs);

        // Edge creations and updates
        const createdEdges = edgesInPayload.filter(e => e.id && !edgeIdsInDB.includes(e.id));
        const updatedEdges = edgesInPayload.filter(e => e.id && edgeIdsInDB.includes(e.id));

        const createEdgesTx = prisma.edge.createMany({
            data: createdEdges.map((newEdge) => ({
                id: newEdge.id!,
                source: newEdge.source,
                sourceHandleId: newEdge.sourceHandleId!,
                target: newEdge.target,
                targetHandleId: newEdge.targetHandleId!,
            })),
        });
        txs.push(createEdgesTx);

        const updatedEdgesTxs = updatedEdges.map((uEdge) => prisma.edge.update({
            data: {
                source: uEdge.source,
                sourceHandleId: uEdge.sourceHandleId!,
                target: uEdge.target,
                targetHandleId: uEdge.targetHandleId!,
            },
            where: {
                id: uEdge.id!,
            }
        }));
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
                template: true
            }
        });

        if (!canvas) {
            throw new HTTPException(404, { message: 'Canvas not found' });
        }

        // Get all edges for this canvas separately for cleaner structure
        const edges = await prisma.edge.findMany({
            where: {
                sourceNode: {
                    canvasId: id
                }
            }
        });

        const handles = await prisma.handle.findMany({
            where: {
                nodeId: {
                    in: nodes.map(m => m.id),
                }
            }
        });

        return c.json({
            canvas: canvas,
            edges,
            nodes,
            handles,
        });
    }
)
.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');

    // Verify ownership
    const existing = await prisma.canvas.findFirst({
        where: { id, userId: user?.id }
    });

    if (!existing) {
        throw new HTTPException(404, { message: 'Canvas not found' });
    }

    await prisma.canvas.delete({
        where: { id },
    });

    return c.json({ success: true });
})
.post('/:id/duplicate', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');

    // Get the original canvas with all its data
    const original = await prisma.canvas.findFirst({
        where: { id, userId: user?.id },
        include: {
            nodes: {
                include: {
                    template: true,
                    handles: true,
                }
            },
        }
    });

    if (!original) {
        throw new HTTPException(404, { message: 'Canvas not found' });
    }

    // Get edges separately
    const originalEdges = await prisma.edge.findMany({
        where: {
            sourceNode: {
                canvasId: id
            }
        }
    });

    // Create the duplicate canvas
    const duplicate = await prisma.canvas.create({
        data: {
            name: `${original.name} (Copy)`,
            userId: user!.id,
        },
    });

    // Create new nodes
    const nodeCreations = original.nodes.map(node => prisma.node.create({
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
        }
    }));

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
            handleCreations.push(prisma.handle.create({
                data: {
                    nodeId: newNodeId,
                    type: oldHandle.type,
                    dataTypes: oldHandle.dataTypes,
                    label: oldHandle.label,
                    order: oldHandle.order,
                    required: oldHandle.required,
                    templateHandleId: oldHandle.templateHandleId,
                }
            }));
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
    const edgeCreations = originalEdges.map(edge => {
        const newSource = nodeIdMap.get(edge.source);
        const newTarget = nodeIdMap.get(edge.target);
        const newSourceHandleId = handleIdMap.get(edge.sourceHandleId);
        const newTargetHandleId = handleIdMap.get(edge.targetHandleId);

        if (!newSource || !newTarget) return null;

        return prisma.edge.create({
            data: {
                source: newSource,
                target: newTarget,
                sourceHandleId: newSourceHandleId!,
                targetHandleId: newTargetHandleId!,
            }
        });
    }).filter(Boolean);

    if (edgeCreations.length > 0) {
        await prisma.$transaction(edgeCreations);
    }

    // Return the duplicate canvas with nodes (without re-fetching everything)
    return c.json({ canvas: { ...duplicate, nodes: newNodes } }, 201);
})
.post('/:id/process',
    zValidator('json', processSchema),
    async (c) => {
        const canvasId = c.req.param('id');
        const validated = c.req.valid('json');
        const user = c.get('user');

        if (!user) {
            throw new HTTPException(401, { message: 'User is not found' });
        }

        const wfProcessor = new NodeWFProcessor(prisma);

        // Starts processing but not await.
        // Frontend starts polling when it get's response.
        const taskBatch = await wfProcessor.processSelectedNodes(canvasId, validated.node_ids, user);

        return c.json(taskBatch, 201);
    }
);

export { canvasRoutes };