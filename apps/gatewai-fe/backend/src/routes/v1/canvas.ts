import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator'
import z from "zod";
import { HTTPException } from "hono/http-exception";
import { prisma, type Task } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";
import { tasks } from "@trigger.dev/sdk";
import type { TASK_LLM } from "../../trigger/llm.js";
import type { EdgeCreateArgs, TextNodeConfig } from "@gatewai/types";
import type { XYPosition } from '@xyflow/react';

const NodeTypes = [
        'Text', 'Preview', 'File', 'Export',
        'Toggle', 'Crawler', 'Resize', 'Agent', 'ThreeD',
        'Painter', 'Blur', 'Compositor', 'Describer', 'Router',
        'Note', 'Number', 'GPTImage1', 'LLM'
    ] as const;

const nodeSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    type: z.enum(NodeTypes),
    position: z.object({
        x: z.number(),
        y: z.number(),
    }),
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
    dataType: z.enum(['Text', 'Number', 'Boolean', 'Image', 'Video', 'Audio', 'File', 'Mask']),
});

const processSchema = z.object({
    node_ids: z.array(z.string()).min(1),
});

const bulkUpdateSchema = z.object({
    name: z.string().min(1).max(20).optional(),
    nodes: z.array(nodeSchema).optional(),
    edges: z.array(edgeSchema).optional(),
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

        const canvas = await prisma.canvas.create({
            data: {
                userId: user.id,
                name: 'New Canvas',
            },
        });

        return c.json(canvas, 201);
    }
)
.get('/:id', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    
    const canvas = await prisma.canvas.findFirst({
        where: {
            id,
            userId: user?.id, // Ensure user owns the canvas
        },
        include: {
            nodes: {
                include: {
                    handles: true,
                    template: {
                        include: {
                            templateHandles: true,
                        }
                    }
                }
            }
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

    return c.json({
        ...canvas,
        edges,
    });
})
.patch('/:id',
    zValidator('json', bulkUpdateSchema),
    async (c) => {
        const id = c.req.param('id');
        const validated = c.req.valid('json');
        const user = c.get('user');
        if (!user) {
            throw new HTTPException(401, { message: 'Unauthorized' });
        }

        const existing = await prisma.canvas.findFirst({
            where: { id, userId: user.id }
        });

        if (!existing) {
            throw new HTTPException(404, { message: 'Canvas not found' });
        }

        const transaction = [];

        if (validated.name !== undefined) {
            transaction.push(
                prisma.canvas.update({
                    where: { id },
                    data: { name: validated.name },
                })
            );
        }

        let deleteEdgeOp = null;
        let deleteNodeOp = null;
        const updateCreateTransactions = [];

        // Collect templateIds for new nodes
        const templateIds = new Set<string>();
        const createIndices: number[] = [];

        // Process nodes
        if (validated.nodes) {
            const existingNodes = await prisma.node.findMany({
                where: { canvasId: id },
                select: { id: true }
            });
            const existingNodeIds = new Set(existingNodes.map(n => n.id));

            const providedNodes = validated.nodes;
            const providedNodeMap = new Map(providedNodes.filter(n => n.id).map(n => [n.id!, n] as [string, typeof n]));

            const toDeleteNodes = existingNodes.filter(n => !providedNodeMap.has(n.id)).map(n => n.id);

            if (toDeleteNodes.length > 0) {
                deleteNodeOp = prisma.node.deleteMany({
                    where: {
                        id: { in: toDeleteNodes },
                        canvasId: id,
                    }
                });
            }

            providedNodes.forEach((node, index) => {
                const { id: nodeId, templateId, type, ...updateData } = node;

                if (nodeId && existingNodeIds.has(nodeId)) {
                    // Update (exclude type and templateId)
                    updateCreateTransactions.push(
                        prisma.node.update({
                            where: { id: nodeId },
                            data: updateData,
                        })
                    );
                    createIndices.push(-1); // Not a create
                } else {
                    // Create
                    const createData = {
                        ...updateData,
                        type,
                        templateId,
                        canvasId: id,
                    };
                    if (nodeId) {
                        createData.id = nodeId;
                    }
                    updateCreateTransactions.push(
                        prisma.node.create({
                            data: createData,
                        })
                    );
                    createIndices.push(index);
                    templateIds.add(templateId);
                }
            });
        }

        // Fetch templates for new nodes
        let templateMap = new Map();
        if (templateIds.size > 0) {
            const templates = await prisma.nodeTemplate.findMany({
                where: { id: { in: Array.from(templateIds) } },
                include: { templateHandles: true }
            });
            templateMap = new Map(templates.map(t => [t.id, t]));
        }

        // Process edges
        if (validated.edges) {
            const existingEdges = await prisma.edge.findMany({
                where: {
                    sourceNode: {
                        canvasId: id
                    }
                },
                select: { id: true }
            });
            const existingEdgeIds = new Set(existingEdges.map(e => e.id));

            const providedEdges = validated.edges;
            const providedEdgeMap = new Map(providedEdges.filter(e => e.id).map(e => [e.id!, e] as [string, typeof e]));

            const toDeleteEdges = existingEdges.filter(e => !providedEdgeMap.has(e.id)).map(e => e.id);

            if (toDeleteEdges.length > 0) {
                deleteEdgeOp = prisma.edge.deleteMany({
                    where: {
                        id: { in: toDeleteEdges }
                    }
                });
            }

            for (const edge of providedEdges) {
                const { id: edgeId, ...updateData } = edge;

                if (edgeId && existingEdgeIds.has(edgeId)) {
                    // Update
                    updateCreateTransactions.push(
                        prisma.edge.update({
                            where: { id: edgeId },
                            data: updateData,
                        })
                    );
                } else {
                    // Create
                    const createData: EdgeCreateArgs["data"] = updateData;
                    if (edgeId) {
                        createData.id = edgeId;
                    }
                    updateCreateTransactions.push(
                        prisma.edge.create({
                            data: createData,
                        })
                    );
                }
            }
        }

        // Add delete operations in order: edges first, then nodes
        if (deleteEdgeOp) {
            transaction.push(deleteEdgeOp);
        }
        if (deleteNodeOp) {
            transaction.push(deleteNodeOp);
        }
        transaction.push(...updateCreateTransactions);

        const results = await prisma.$transaction(transaction);

        // Extract update/create results (last part of results)
        const updateCreateResults = results.slice(results.length - updateCreateTransactions.length);

        // Create handles for new nodes (outside transaction for simplicity)
        const handleTransactions = [];
        let resultIndex = 0;
        for (const createIndex of createIndices) {
            if (createIndex !== -1) {
                const node = validated.nodes![createIndex];
                const newNode = updateCreateResults[resultIndex];
                const template = templateMap.get(node.templateId);
                if (template) {
                    // Sort templateHandles by id for consistent order
                    const sortedHandles = [...template.templateHandles].sort((a, b) => a.id.localeCompare(b.id));
                    sortedHandles.forEach((th, order) => {
                        handleTransactions.push(
                            prisma.handle.create({
                                data: {
                                    nodeId: newNode.id,
                                    type: th.type,
                                    dataType: th.dataType,
                                    label: th.label,
                                    order,
                                    required: th.required,
                                    templateHandleId: th.id,
                                }
                            })
                        );
                    });
                }
            }
            resultIndex++;
        }

        if (handleTransactions.length > 0) {
            await prisma.$transaction(handleTransactions);
        }

        // Fetch updated canvas
        const canvas = await prisma.canvas.findFirst({
            where: {
                id,
                userId: user.id,
            },
            include: {
                nodes: {
                    include: {
                        handles: true,
                        template: {
                            include: {
                                templateHandles: true,
                            }
                        }
                    }
                },
            }
        });

        if (!canvas) {
            throw new HTTPException(404, { message: 'Canvas not found' });
        }

        const edges = await prisma.edge.findMany({
            where: {
                sourceNode: {
                    canvasId: id
                }
            }
        });

        return c.json({
            ...canvas,
            edges,
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
.post('/:canvasId/nodes',
    zValidator('json', nodeSchema),
    async (c) => {
        const canvasId = c.req.param('canvasId');
        const validated = c.req.valid('json');
        const user = c.get('user');

        // Verify canvas ownership
        const canvas = await prisma.canvas.findFirst({
            where: { id: canvasId, userId: user?.id }
        });

        if (!canvas) {
            throw new HTTPException(404, { message: 'Canvas not found' });
        }

        // Fetch template
        const template = await prisma.nodeTemplate.findUnique({
            where: { id: validated.templateId },
            include: { templateHandles: true }
        });

        if (!template) {
            throw new HTTPException(400, { message: 'Invalid template' });
        }

        let node;
        await prisma.$transaction(async (tx) => {
            node = await tx.node.create({
                data: {
                    name: validated.name,
                    type: validated.type,
                    position: validated.position,
                    width: validated.width,
                    height: validated.height,
                    draggable: validated.draggable,
                    selectable: validated.selectable,
                    deletable: validated.deletable,
                    config: validated.config,
                    result: validated.result,
                    isDirty: validated.isDirty,
                    zIndex: validated.zIndex,
                    templateId: validated.templateId,
                    canvasId,
                }
            });

            // Sort templateHandles by id for consistent order
            const sortedHandles = [...template.templateHandles].sort((a, b) => a.id.localeCompare(b.id));

            for (let order = 0; order < sortedHandles.length; order++) {
                const th = sortedHandles[order];
                await tx.handle.create({
                    data: {
                        nodeId: node.id,
                        type: th.type,
                        dataType: th.dataType,
                        label: th.label,
                        order,
                        required: th.required,
                        templateHandleId: th.id,
                    }
                });
            }
        });

        // Fetch the node with includes
        node = await prisma.node.findUnique({
            where: { id: node!.id },
            include: {
                template: {
                    include: {
                        templateHandles: true,
                    }
                }
            }
        });

        return c.json({ node }, 201);
    }
).post('/:canvasId/edges',
    zValidator('json', edgeSchema),
    async (c) => {
        const canvasId = c.req.param('canvasId');
        const validated = c.req.valid('json');
        const user = c.get('user');

        // Verify canvas ownership and that both nodes exist in this canvas
        const nodes = await prisma.node.findMany({
            where: {
                id: { in: [validated.source, validated.target] },
                canvasId,
                canvas: {
                    userId: user?.id
                }
            }
        });

        if (nodes.length !== 2) {
            throw new HTTPException(400, { message: 'Invalid source or target node' });
        }

        // Check if edge already exists (considering handles)
        const existing = await prisma.edge.findFirst({
            where: {
                source: validated.source,
                sourceHandleId: validated.sourceHandleId ?? undefined,
                target: validated.target,
                targetHandleId: validated.targetHandleId ?? undefined,
            }
        });

        if (existing) {
            throw new HTTPException(400, { message: 'Edge already exists' });
        }

        const edge = await prisma.edge.create({
            data: validated,
        });

        return c.json({ edge }, 201);
    }
)
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
                    dataType: oldHandle.dataType,
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
                sourceHandleId: newSourceHandleId,
                targetHandleId: newTargetHandleId,
                dataType: edge.dataType,
            }
        });
    }).filter(Boolean);

    if (edgeCreations.length > 0) {
        await prisma.$transaction(edgeCreations);
    }

    // Return the duplicate canvas with nodes (without re-fetching everything)
    return c.json({ canvas: { ...duplicate, nodes: newNodes } }, 201);
})
.post('/:canvasId/process',
    zValidator('json', processSchema),
    async (c) => {
        const canvasId = c.req.param('canvasId');
        const validated = c.req.valid('json');
        const user = c.get('user');

        const nodes = await prisma.node.findMany({
            where: {
                id: { in: validated.node_ids },
                canvasId,
                canvas: {
                    userId: user?.id
                },
            },
            include: {
                handles: true,
                template: true,
            }
        });

        if (nodes.length < 1) {
            throw new HTTPException(400, { message: 'Invalid source or target node' });
        }
        
        const clientProcessNodes = nodes.filter(node => node.template.processEnvironment === 'Browser');
        if (clientProcessNodes.length > 0) {
            throw new HTTPException(400, { message: 'Some nodes are set to be processed in the client environment.' });
        }

        const createdTasks: Task[] = [];

        nodes.forEach(async node => {
            const nodeData = node.config as TextNodeConfig;
            if (!nodeData.content) {
                throw new HTTPException(400, { message: `Node ${node.id} does not have a prompt defined.` });
            }
            const taskHandle = await tasks.trigger<typeof TASK_LLM>('run-llm', {
                nodeId: node.id,
                model: 'gpt-4o',
                prompt: nodeData.content,
            });

            const task = await prisma.task.create({
                data: {
                    canvasId: canvasId,
                    userId: user!.id,
                    nodeId: node.id,
                    publicAccessToken: taskHandle.publicAccessToken,
                    taskId: taskHandle.id,
                    name: taskHandle.taskIdentifier,
                }
            });

            createdTasks.push(task);
        });

        return c.json({ createdTasks }, 201);
    }
);

export { canvasRoutes };