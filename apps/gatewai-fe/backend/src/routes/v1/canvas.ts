import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator'
import z from "zod";
import { HTTPException } from "hono/http-exception";
import { prisma, type Task } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";
import { tasks } from "@trigger.dev/sdk";
import type { TASK_LLM } from "../../trigger/llm.js";
import type { TextNodeConfig } from "@gatewai/types";




const nodeSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    type: z.enum([
        'Text', 'Preview', 'File', 'Export', 
        'Toggle', 'Crawler', 'Resize', 'Agent', 'ThreeD',
        'Mask', 'Painter', 'Blur', 'Compositor', 'Describer', 'Router'
    ]),
    position: z.object({
        x: z.number(),
        y: z.number(),
    }),
    width: z.number().optional(),
    height: z.number().optional(),
    draggable: z.boolean().optional().default(true),
    selectable: z.boolean().optional().default(true),
    deletable: z.boolean().optional().default(true),
    fileData: z.any().optional(),
    result: z.any().optional(),
    config: z.any().optional(),
    visible: z.boolean().optional().default(true),
    zIndex: z.number().optional(),
    templateId: z.string(),
});

const edgeSchema = z.object({
    id: z.string().optional(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
    dataType: z.enum(['Text', 'Number', 'Boolean', 'Image', 'Video', 'Audio', 'File']),
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
                    template: {
                        include: {
                            inputTypes: true,
                            outputTypes: true,
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
        canvas: {
            ...canvas,
            edges,
        }
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

        const transaction: any[] = [];

        if (validated.name !== undefined) {
            transaction.push(
                prisma.canvas.update({
                    where: { id },
                    data: { name: validated.name },
                })
            );
        }

        let deleteEdgeOp: any = null;
        let deleteNodeOp: any = null;
        const updateCreateTransactions: any[] = [];

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

            for (const node of providedNodes) {
                const { id: nodeId, templateId, type, ...updateData } = node;

                if (nodeId && existingNodeIds.has(nodeId)) {
                    // Update (exclude type and templateId)
                    updateCreateTransactions.push(
                        prisma.node.update({
                            where: { id: nodeId },
                            data: updateData,
                        })
                    );
                } else {
                    // Create
                    const createData: any = {
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
                }
            }
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
                    const createData: any = updateData;
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

        await prisma.$transaction(transaction);

        // Fetch updated canvas
        const canvas = await prisma.canvas.findFirst({
            where: {
                id,
                userId: user.id,
            },
            include: {
                nodes: {
                    include: {
                        template: {
                            include: {
                                inputTypes: true,
                                outputTypes: true,
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
            canvas: {
                ...canvas,
                edges,
            }
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

        const node = await prisma.node.create({
            data: {
                ...validated,
                canvasId,
            },
            include: {
                template: {
                    include: {
                        inputTypes: true,
                        outputTypes: true,
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
                sourceHandle: validated.sourceHandle || null,
                target: validated.target,
                targetHandle: validated.targetHandle || null,
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

    // Create the duplicate canvas with nodes
    const duplicate = await prisma.canvas.create({
        data: {
            name: `${original.name} (Copy)`,
            userId: user!.id,
            nodes: {
                create: original.nodes.map(node => ({
                    name: node.name,
                    type: node.type,
                    position: node.position as any,
                    width: node.width,
                    height: node.height,
                    draggable: node.draggable,
                    selectable: node.selectable,
                    deletable: node.deletable,
                    config: node.config ?? {},
                    zIndex: node.zIndex,
                    template: {
                        connect: {
                            id: node.templateId,
                        }
                    }
                }))
            }
        },
        include: {
            nodes: true,
        }
    });

    // Create a mapping of old node IDs to new node IDs
    const nodeIdMap = new Map<string, string>();
    original.nodes.forEach((oldNode, index) => {
        nodeIdMap.set(oldNode.id, duplicate.nodes[index].id);
    });

    // Create edges with new node IDs
    const edgeCreations = originalEdges.map(edge => {
        const newSource = nodeIdMap.get(edge.source);
        const newTarget = nodeIdMap.get(edge.target);
        
        if (!newSource || !newTarget) return null;

        return prisma.edge.create({
            data: {
                source: newSource,
                target: newTarget,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle,
                dataType: edge.dataType,
            }
        });
    }).filter(Boolean);

    if (edgeCreations.length > 0) {
        await prisma.$transaction(edgeCreations as any[]);
    }

    return c.json({ canvas: duplicate }, 201);
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