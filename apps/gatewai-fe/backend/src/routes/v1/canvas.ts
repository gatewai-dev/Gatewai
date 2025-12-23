import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator'
import z from "zod";
import { HTTPException } from "hono/http-exception";
import { prisma, type Task } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";
import type { TASK_LLM } from "../../trigger/llm.js";
import type { TextNodeConfig } from "@gatewai/types";
import type { XYPosition } from '@xyflow/react';

const NodeTypes = [
        'Text', 'Preview', 'File', 'Export',
        'Toggle', 'Crawler', 'Resize', 'Agent', 'ThreeD',
        'Painter', 'Blur', 'Compositor', 'Describer', 'Router',
        'Note', 'Number', 'GPTImage1', 'LLM'
] as const;

const DataTypes = ["Text", "Number","Boolean", "Image", "Video", "Audio", "File", "Mask", "VideoLayer", "DesignLayer", "Any"] as const

const handleSchema = z.object({
    id: z.string().optional(),
    type: z.enum(['Input', 'Output']), // From HandleType enum
    dataType: z.enum(DataTypes),
    label: z.string().optional().nullable(),
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
    dataType: z.enum(DataTypes),
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
    });

    const nodes = await prisma.node.findMany({
        where: {
            canvasId: canvas?.id,
        },
        include: {
            template: true
        }
    })

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
    })

    return c.json({
        canvas: canvas,
        edges,
        nodes,
        handles,
    });
})
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

        // Prepare main transaction array
        const transactions = [];
        /**
         * 1- Get canvas entities from DB
         */
        const nodesInDB = await prisma.node.findMany({
            where: {
                canvasId: id,
            }
        })
        const nodesInPayload = validated.nodes;
        const edgesInPayload = validated.edges;
        const handlesInPayload = validated.handles;

        const nodeIdsInDB = nodesInDB.map(m => m.id);
        const nodeIdsInPayload = nodesInPayload?.map(m => m.id).filter(Boolean) as string[] ?? [];

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
        })

        const edgeIdsInDB = edgesInDB.map(m => m.id);


        const handlesInDB = await prisma.handle.findMany({
            where: {
                nodeId: {
                    in: nodeIdsInDB,
                }
            }
        })

        const handleIdsInDB = handlesInDB.map(m => m.id);

        /**
         * 2- Create transactions for removed edges
         */


        const removedNodeIds = nodesInDB.filter(f => !nodeIdsInPayload.includes(f.id)).map(m => m.id);

        const removedNodeEdges = await prisma.edge.findMany({
            where: {
                OR: [
                    {
                        targetNode: {
                            id: {
                                in: removedNodeIds,
                            }
                        },
                    },
                    {
                        sourceNode: {
                            id: {
                                in: removedNodeIds,
                            }
                        },
                    }
                ]
            }
        })

        const removedNodeEdgeIds = removedNodeEdges.map(m => m.id);

        // Check if edge is sent from client
        const edgeIdsInPayload = validated.edges?.map(m => m.id);
        const edgeIdsNotInPayload = edgesInDB.filter(f => edgeIdsInPayload?.includes(f.id)).map(m => m.id)

        // Concat both edge ids that not found
        const removedEdgeIds = [...removedNodeEdgeIds, ...edgeIdsNotInPayload];
        const edgeIdsToDeleteFromDB = [...new Set(removedEdgeIds)];

        if (edgeIdsToDeleteFromDB.length > 0) {
            const deleteEdgeTransaction = prisma.node.deleteMany({
                where: {
                    id: {
                        in: edgeIdsToDeleteFromDB
                    }
                }
            })

            transactions.push(deleteEdgeTransaction);
        }


        let handleIdsToRemove: string[] = [];
        // 1- Handles in removed nodes
        const removedNodeHandle = await prisma.handle.findMany({
            select: {
                id: true,
            },
            where: {
                nodeId: {
                    in: removedNodeIds
                }
            }
        })

        const removedNodeHandleIds = removedNodeHandle.map(m => m.id)
        handleIdsToRemove = [...removedNodeHandleIds];

        // 2- Handles that is not in payload
        const handleIdsInPayload = validated.handles?.map(m => m.id).filter(f => f);
        if (handleIdsInPayload && handleIdsInPayload.length) {
            const removedDBHandles = await prisma.handle.findMany({
                where: {
                    AND: [
                        {
                            id: {
                                notIn: handleIdsInPayload.filter(Boolean) as string[]
                            }
                        },
                        {
                            node: {
                                canvasId: id,
                            }
                        }
                    ]
                }
            })
            const removedDBHandleIds = removedDBHandles.map(m => m.id);
            handleIdsToRemove = [...removedDBHandleIds, ...handleIdsToRemove];
        }
        // Concat both as unique IDs
        const uniqueHandleIdsToRemove = [...new Set(handleIdsToRemove)]
        const deleteHandleTransactions = prisma.handle.deleteMany({
            where: {
                id: {
                    in: uniqueHandleIdsToRemove
                }
            }
        })
        // PUSH HANDLE DELETE TO TRANSACTIONS
        transactions.push(deleteHandleTransactions)

        // Prepare delete node transaction
        const deleteNodesTransaction = prisma.node.deleteMany({
            where: {
                id: {
                    in: removedNodeIds,
                }
            }
        })

        transactions.push(deleteNodesTransaction)

        const [deletedPostCount, deletedHandleCount, deletedNodeCount] = await prisma.$transaction(transactions)
        console.log({deletedPostCount, deletedHandleCount, deletedNodeCount});

        // Node/Handle Creation and Update transaction
        let nodeCreationAndUpdateTransactions = [];
        if (nodesInPayload && nodesInPayload.length > 0) {
            const updatedNodes = nodesInPayload.filter(f => f.id && nodeIdsInDB.includes(f.id))
            const createdNodes = nodesInPayload.filter(f => f.id && !nodeIdsInDB.includes(f.id))

            console.log({updatedNodes, createdNodes})

            const newNodesTransaction = prisma.node.createMany({
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
            
            if (handlesInPayload && handlesInPayload.length) {
                const newHandles = handlesInPayload.filter(f => f.id && !handleIdsInDB.includes(f.id));

                const newHandlesTransaction = prisma.handle.createMany({
                    data: newHandles.map((newHandle) => ({
                        id: newHandle.id,
                        templateHandleId: newHandle.templateHandleId,
                        type: newHandle.type,
                        order: newHandle.order,
                        dataType: newHandle.dataType,
                        label: newHandle.label,
                        required: newHandle.required,
                        nodeId: newHandle.nodeId,
                    }))
                })

                // STEP: New HANDLES
                nodeCreationAndUpdateTransactions.push(newHandlesTransaction);
            }

            const updatedNodesTransactions = updatedNodes.map((uNode) => prisma.node.update({
                data: {
                    result: uNode.result,
                    config: uNode.config,
                    position: uNode.position,
                    name: uNode.name,
                },
                where: {
                    id: uNode.id,
                }
            }));


            // STEP: UPDATED NODES
            nodeCreationAndUpdateTransactions = [newNodesTransaction, ...updatedNodesTransactions]
        }

        // Add handles that are in payload but not in db
        if (handleIdsInPayload) {
            const handlesToCreate = handlesInPayload
                ?.filter(handle => handle.id && !handleIdsInDB.includes(handle.id))
                .filter(Boolean);
            if (handlesToCreate && handlesToCreate.length > 0) {
                const createHandlesTransaction = prisma.handle.createMany({
                    data: handlesToCreate.map((nHandle) => ({
                        id: nHandle.id,
                        nodeId: nHandle.nodeId,
                        required: nHandle.required,
                        dataType: nHandle.dataType,
                        label: nHandle.label,
                        order: nHandle.order,
                        templateHandleId: nHandle.templateHandleId,
                        type: nHandle.type
                    }))
                })
                nodeCreationAndUpdateTransactions = [...nodeCreationAndUpdateTransactions, createHandlesTransaction]
            }
        }

        await prisma.$transaction(nodeCreationAndUpdateTransactions)


        /// Create & Update Edges

        const deletedEdges = edgesInDB.filter(f => edgeIdsInPayload?.includes(f.id));
        let edgesTransactions = [];
        if (edgesInPayload && edgesInPayload.length > 0) {
            const updatedEdges = edgesInPayload.filter(f => f.id && edgeIdsInDB.includes(f.id))
            const createdEdges = edgesInPayload.filter(f => f.id && !edgeIdsInDB.includes(f.id))

            console.log({updatedEdges: updatedEdges.length, createdEdges: createdEdges.length, deletedEdges: deletedEdges.length})

            const newEdgesTransaction = prisma.edge.createMany({
                data: createdEdges.map((newEdge) => ({
                    id: newEdge.id,
                    source: newEdge.source,
                    sourceHandleId: newEdge.sourceHandleId!,
                    target: newEdge.target,
                    targetHandleId: newEdge.targetHandleId!,
                    dataType: newEdge.dataType,
                })),
            });

            const updatedEdgesTransactions = updatedEdges.map((uEdge) => prisma.edge.update({
                data: {
                    source: uEdge.source,
                    sourceHandleId: uEdge.sourceHandleId!,
                    target: uEdge.target,
                    targetHandleId: uEdge.targetHandleId!,
                    dataType: uEdge.dataType,
                },
                where: {
                    id: uEdge.id,
                }
            }));

            edgesTransactions = [newEdgesTransaction, ...updatedEdgesTransactions]
        }

        if (deletedEdges && deletedEdges.length > 0) {
            const deletedEdgesTransaction = prisma.edge.deleteMany({
                where: {
                    id: {
                        in: deletedEdges.map(m => m.id)
                    }
                }
            })
            edgesTransactions.push(deletedEdgesTransaction);
        }
        await prisma.$transaction(edgesTransactions)



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
        })

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
        })

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
.post('/:id/process',
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