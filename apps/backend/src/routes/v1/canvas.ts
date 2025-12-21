import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator'
import z from "zod";
import { streamSSE } from 'hono/streaming'
import { HTTPException } from "hono/http-exception";
import { prisma } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";

const canvasRoutes = new Hono<{Variables: AuthHonoTypes}>({
    strict: false,
});

// =====================
// Validation Schemas
// =====================

const createCanvasSchema = z.object({
    name: z.string().min(1).max(20),
});

const updateCanvasSchema = z.object({
    name: z.string().min(1).max(20).optional(),
});

const createNodeSchema = z.object({
    name: z.string(),
    type: z.enum([
        'Prompt', 'Preview', 'Video', 'Audio', 'File', 'Export', 
        'Toggle', 'Crawler', 'Resize', 'Group', 'Agent', 'ThreeD',
        'Mask', 'Painter', 'Blur', 'Compositor', 'Describer', 'Router'
    ]),
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    draggable: z.boolean().optional().default(true),
    selectable: z.boolean().optional().default(true),
    deletable: z.boolean().optional().default(true),
    fileData: z.any().optional(),
    data: z.any().optional(),
    visible: z.boolean().optional().default(true),
    zIndex: z.number().optional(),
    templateId: z.string(),
});

const updateNodeSchema = z.object({
    name: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    draggable: z.boolean().optional(),
    selectable: z.boolean().optional(),
    deletable: z.boolean().optional(),
    fileData: z.any().optional(),
    data: z.any().optional(),
    visible: z.boolean().optional(),
    zIndex: z.number().optional(),
});

const batchUpdateNodesSchema = z.object({
    updates: z.array(z.object({
        id: z.string(),
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        data: z.any().optional(),
    }))
});

const createEdgeSchema = z.object({
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
    dataType: z.enum(['Text', 'Number', 'Boolean', 'Image', 'Video', 'Audio', 'File']),
});

const batchEdgesSchema = z.object({
    create: z.array(createEdgeSchema).optional(),
    delete: z.array(z.string()).optional(), // Array of edge IDs to delete
});

// =====================
// Canvas Operations
// =====================

// List all canvases for the authenticated user
canvasRoutes.get('/', async (c) => {
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
            _count: {
                select: {
                    nodes: true,
                }
            }
        }
    });

    return c.json({ canvases });
});

// Create a new canvas
canvasRoutes.post('/',
    zValidator('json', createCanvasSchema),
    async (c) => {
        const validated = c.req.valid('json');
        const user = c.get('user');
        if (!user) {
            throw new HTTPException(401, { message: 'Unauthorized' });
        }

        const canvas = await prisma.canvas.create({
            data: {
                userId: user.id,
                name: validated.name,
            },
        });

        return c.json({ canvas }, 201);
    }
);

// Get a specific canvas with all nodes and edges
canvasRoutes.get('/:id', async (c) => {
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
            },
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
});

// Update a canvas
canvasRoutes.patch('/:id',
    zValidator('json', updateCanvasSchema),
    async (c) => {
        const id = c.req.param('id');
        const validated = c.req.valid('json');
        const user = c.get('user');

        // Verify ownership
        const existing = await prisma.canvas.findFirst({
            where: { id, userId: user?.id }
        });

        if (!existing) {
            throw new HTTPException(404, { message: 'Canvas not found' });
        }

        const canvas = await prisma.canvas.update({
            where: { id },
            data: validated,
        });

        return c.json({ canvas });
    }
);

// Delete a canvas
canvasRoutes.delete('/:id', async (c) => {
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
});

// =====================
// Node Operations
// =====================

// Create a new node in a canvas
canvasRoutes.post('/:canvasId/nodes',
    zValidator('json', createNodeSchema),
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
);

// Update a node
canvasRoutes.patch('/:canvasId/nodes/:nodeId',
    zValidator('json', updateNodeSchema),
    async (c) => {
        const canvasId = c.req.param('canvasId');
        const nodeId = c.req.param('nodeId');
        const validated = c.req.valid('json');
        const user = c.get('user');

        // Verify canvas ownership and node existence
        const node = await prisma.node.findFirst({
            where: {
                id: nodeId,
                canvasId,
                canvas: {
                    userId: user?.id
                }
            }
        });

        if (!node) {
            throw new HTTPException(404, { message: 'Node not found' });
        }

        const updatedNode = await prisma.node.update({
            where: { id: nodeId },
            data: validated,
            include: {
                template: {
                    include: {
                        inputTypes: true,
                        outputTypes: true,
                    }
                }
            }
        });

        return c.json({ node: updatedNode });
    }
);

// Batch update nodes (useful for drag operations)
canvasRoutes.patch('/:canvasId/nodes',
    zValidator('json', batchUpdateNodesSchema),
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

        // Batch update nodes
        const updates = validated.updates.map(update => 
            prisma.node.update({
                where: { id: update.id },
                data: {
                    x: update.x,
                    y: update.y,
                    width: update.width,
                    height: update.height,
                    data: update.data,
                }
            })
        );

        await prisma.$transaction(updates);

        return c.json({ success: true, updated: validated.updates.length });
    }
);

// Delete a node
canvasRoutes.delete('/:canvasId/nodes/:nodeId', async (c) => {
    const canvasId = c.req.param('canvasId');
    const nodeId = c.req.param('nodeId');
    const user = c.get('user');

    // Verify canvas ownership and node existence
    const node = await prisma.node.findFirst({
        where: {
            id: nodeId,
            canvasId,
            canvas: {
                userId: user?.id
            }
        }
    });

    if (!node) {
        throw new HTTPException(404, { message: 'Node not found' });
    }

    await prisma.node.delete({
        where: { id: nodeId },
    });

    return c.json({ success: true });
});

// Delete multiple nodes
canvasRoutes.post('/:canvasId/nodes/delete',
    zValidator('json', z.object({
        nodeIds: z.array(z.string())
    })),
    async (c) => {
        const canvasId = c.req.param('canvasId');
        const { nodeIds } = c.req.valid('json');
        const user = c.get('user');

        // Verify canvas ownership
        const canvas = await prisma.canvas.findFirst({
            where: { id: canvasId, userId: user?.id }
        });

        if (!canvas) {
            throw new HTTPException(404, { message: 'Canvas not found' });
        }

        await prisma.node.deleteMany({
            where: {
                id: { in: nodeIds },
                canvasId,
            }
        });

        return c.json({ success: true, deleted: nodeIds.length });
    }
);

// =====================
// Edge Operations
// =====================

// Create a new edge
canvasRoutes.post('/:canvasId/edges',
    zValidator('json', createEdgeSchema),
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
);

// Batch create/delete edges (useful for bulk operations)
canvasRoutes.post('/:canvasId/edges/batch',
    zValidator('json', batchEdgesSchema),
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

        const operations = [];

        // Delete edges
        if (validated.delete && validated.delete.length > 0) {
            operations.push(
                prisma.edge.deleteMany({
                    where: {
                        id: { in: validated.delete },
                        sourceNode: {
                            canvasId
                        }
                    }
                })
            );
        }

        // Create edges
        if (validated.create && validated.create.length > 0) {
            for (const edgeData of validated.create) {
                operations.push(
                    prisma.edge.create({
                        data: edgeData,
                    })
                );
            }
        }

        await prisma.$transaction(operations);

        return c.json({
            success: true,
            created: validated.create?.length || 0,
            deleted: validated.delete?.length || 0,
        });
    }
);

// Delete an edge
canvasRoutes.delete('/:canvasId/edges/:edgeId', async (c) => {
    const canvasId = c.req.param('canvasId');
    const edgeId = c.req.param('edgeId');
    const user = c.get('user');

    // Verify canvas ownership
    const edge = await prisma.edge.findFirst({
        where: {
            id: edgeId,
            sourceNode: {
                canvasId,
                canvas: {
                    userId: user?.id
                }
            }
        }
    });

    if (!edge) {
        throw new HTTPException(404, { message: 'Edge not found' });
    }

    await prisma.edge.delete({
        where: { id: edgeId },
    });

    return c.json({ success: true });
});

// =====================
// Utility Operations
// =====================

// Duplicate a canvas
canvasRoutes.post('/:id/duplicate', async (c) => {
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
                    x: node.x + 50, // Offset position slightly
                    y: node.y + 50,
                    width: node.width,
                    height: node.height,
                    draggable: node.draggable,
                    selectable: node.selectable,
                    deletable: node.deletable,
                    fileData: node.fileData,
                    data: node.data,
                    visible: node.visible,
                    zIndex: node.zIndex,
                    templateId: node.templateId,
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
});

export { canvasRoutes };