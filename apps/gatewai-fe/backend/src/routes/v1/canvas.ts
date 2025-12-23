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
    templateHandleId: z.string().optional(),
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
        const transaction: any[] = [];

        // Step 2: Handle name update if provided
        if (validated.name !== undefined) {
            transaction.push(
                prisma.canvas.update({
                    where: { id },
                    data: { name: validated.name },
                })
            );
        }

        // Step 3: Process Nodes
        // Fetch existing nodes for this canvas
        const existingNodes = await prisma.node.findMany({
            where: { canvasId: id },
            select: { id: true, templateId: true } // Include templateId for later handle sync
        });
        const existingNodeIds = new Set(existingNodes.map(n => n.id));
        const nodeIdToTemplateId = new Map(existingNodes.map(n => [n.id, n.templateId]));

        let deleteNodeOp = null;
        const nodeOperations: any[] = []; // For creates and updates
        let toDeleteNodeIds: string[] = [];

        if (validated.nodes) {
            const providedNodes = validated.nodes;
            const providedNodeMap = new Map(providedNodes.filter(n => n.id).map(n => [n.id!, n]));

            // Identify nodes to delete
            toDeleteNodeIds = existingNodes.filter(n => !providedNodeMap.has(n.id)).map(n => n.id);
            if (toDeleteNodeIds.length > 0) {
                deleteNodeOp = prisma.node.deleteMany({
                    where: { id: { in: toDeleteNodeIds }, canvasId: id }
                });
            }

            // Process each provided node
            for (const node of providedNodes) {
                const { id: nodeId, templateId, type, handles: providedHandles, ...updateData } = node;

                if (nodeId && existingNodeIds.has(nodeId)) {
                    // Update existing node (exclude immutable fields: type, templateId)
                    nodeOperations.push(
                        prisma.node.update({
                            where: { id: nodeId },
                            data: updateData,
                        })
                    );
                } else {
                    // Create new node
                    const createData = {
                        ...updateData,
                        type,
                        templateId,
                        canvasId: id,
                    };
                    if (nodeId) createData.id = nodeId; // Use client-provided ID if present
                    nodeOperations.push(
                        prisma.node.create({
                            data: createData,
                        })
                    );
                }
            }
        }

        // Add node delete to transaction (first, for cascades)
        if (deleteNodeOp) transaction.push(deleteNodeOp);
        // Add node creates/updates
        transaction.push(...nodeOperations);

        // Execute node-related transaction and get results
        const results = await prisma.$transaction(transaction);
        // Extract created/updated nodes (last N items where N = nodeOperations.length)
        const nodeResults = results.slice(results.length - nodeOperations.length);

        // Build map of all node IDs (old and new). For new nodes, map client ID (if provided) to DB ID
        const nodeIdMap = new Map<string, string>();
        let nodeResultIndex = 0;
        if (validated.nodes) {
            for (const node of validated.nodes) {
                const resultNode = nodeResults[nodeResultIndex];
                const clientId = node.id;
                nodeIdMap.set(resultNode.id, resultNode.id);
                if (clientId && clientId !== resultNode.id) {
                    nodeIdMap.set(clientId, resultNode.id);
                }
                nodeResultIndex++;
            }
        }
        // Add remaining existing nodes (not deleted)
        existingNodes.forEach(n => {
            if (!toDeleteNodeIds.includes(n.id)) {
                nodeIdMap.set(n.id, n.id);
            }
        });

        // Step 4: Process Handles
        // First, fetch all templates needed (for sync if not variable)
        const allTemplateIds = new Set([...existingNodes.map(n => n.templateId), ...(validated.nodes?.map(n => n.templateId) || [])]);
        const templates = await prisma.nodeTemplate.findMany({
            where: { id: { in: Array.from(allTemplateIds) } },
            include: { templateHandles: true }
        });
        const templateMap = new Map(templates.map(t => [t.id, t]));

        // Fetch all existing handles for the canvas
        const existingHandles = await prisma.handle.findMany({
            where: { node: { canvasId: id } },
            select: { id: true, nodeId: true }
        });
        const existingHandleIdsByNode = new Map<string, Set<string>>(); // nodeId -> set of handleIds
        existingHandles.forEach(h => {
            if (!existingHandleIdsByNode.has(h.nodeId)) existingHandleIdsByNode.set(h.nodeId, new Set());
            existingHandleIdsByNode.get(h.nodeId)!.add(h.id);
        });

        const handleOperations: any[] = [];
        const handleIdMap = new Map<string, string>(); // clientHandleId -> dbHandleId (for edges)

        // Process handles for each node (existing and new)
        if (validated.nodes) {
            let nodeIndex = 0;
            for (const node of validated.nodes) {
                const nodeId = node.id && existingNodeIds.has(node.id) ? node.id : nodeIdMap.get(node.id ?? nodeResults[nodeIndex].id)!;
                const templateId = node.templateId || nodeIdToTemplateId.get(nodeId!); // For existing, use fetched
                const template = templateMap.get(templateId);
                const isVariable = template?.variableInputs || template?.variableOutputs || false;
                const providedHandles = node.handles || [];

                // Fetch existing handles for this node (if existing node)
                const existingHandleIdsForNode = existingHandleIdsByNode.get(nodeId!) || new Set();

                if (isVariable) {
                    // Variable handles: Treat like nodes/edges - delete missing, create new, update existing
                    const providedHandleMap = new Map(providedHandles.filter(h => h.id).map(h => [h.id!, h]));

                    // Identify handles to delete
                    const toDeleteHandleIds = Array.from(existingHandleIdsForNode).filter(hId => !providedHandleMap.has(hId));
                    if (toDeleteHandleIds.length > 0) {
                        handleOperations.push(
                            prisma.handle.deleteMany({
                                where: { id: { in: toDeleteHandleIds }, nodeId }
                            })
                        );
                    }

                    // Process provided handles
                    for (const handle of providedHandles) {
                        const { id: handleId, ...handleData } = handle;
                        const createOrUpdateData = {
                            ...handleData,
                            nodeId,
                        };

                        if (handleId && existingHandleIdsForNode.has(handleId)) {
                            // Update
                            handleOperations.push(
                                prisma.handle.update({
                                    where: { id: handleId },
                                    data: createOrUpdateData,
                                })
                            );
                            handleIdMap.set(handleId, handleId);
                        } else {
                            // Create
                            if (handleId) createOrUpdateData.id = handleId;
                            const op = prisma.handle.create({
                                data: createOrUpdateData,
                            });
                            handleOperations.push(op);
                            // We'll map after execution
                        }
                    }
                } else {
                    // Fixed handles: Sync to template (delete extras, create missing, update existing)
                    if (!template) continue; // Skip if no template

                    const sortedTemplateHandles = [...template.templateHandles].sort((a, b) => a.id.localeCompare(b.id));

                    // Identify extras to delete (existing not in template)
                    // For efficiency, perhaps fetch full handles earlier, but for now assume sync by recreating if changed

                    // Create or update to match template
                    sortedTemplateHandles.forEach((th, order) => {
                        // Find matching provided or existing by templateHandleId
                        const matchingProvided = providedHandles.find(h => h.templateHandleId === th.id);
                        const createData = {
                            nodeId,
                            type: matchingProvided?.type || th.type,
                            dataType: matchingProvided?.dataType || th.dataType,
                            label: matchingProvided?.label || th.label,
                            order: matchingProvided?.order || order,
                            required: matchingProvided?.required || th.required,
                            templateHandleId: th.id,
                        };

                        if (matchingProvided?.id && existingHandleIdsForNode.has(matchingProvided.id)) {
                            // Update
                            handleOperations.push(
                                prisma.handle.update({
                                    where: { id: matchingProvided.id },
                                    data: createData,
                                })
                            );
                            handleIdMap.set(matchingProvided.id, matchingProvided.id);
                        } else {
                            // Create
                            if (matchingProvided?.id) createData.id = matchingProvided.id;
                            handleOperations.push(
                                prisma.handle.create({
                                    data: createData,
                                })
                            );
                            // Map after
                        }
                    });
                }
                nodeIndex++;
            }
        }

        // Execute handle operations
        if (handleOperations.length > 0) {
            await prisma.$transaction(handleOperations);
            // Build handleIdMap for new handles (assuming operations are in order, track creates)
            // For simplicity, re-fetch all handles after
            const allUpdatedHandles = await prisma.handle.findMany({
                where: { node: { canvasId: id } }
            });
            allUpdatedHandles.forEach(h => handleIdMap.set(h.id, h.id)); // Existing are identity
            // For new, if client provided id, but since we used it in create, it's the same
            // If not, client didn't provide, so no need to map temp ids
        }

        // Step 5: Process Edges
        const existingEdges = await prisma.edge.findMany({
            where: { sourceNode: { canvasId: id } },
            select: { id: true }
        });
        const existingEdgeIds = new Set(existingEdges.map(e => e.id));

        let deleteEdgeOp = null;
        const edgeOperations: any[] = [];

        if (validated.edges) {
            const providedEdges = validated.edges;
            const providedEdgeMap = new Map(providedEdges.filter(e => e.id).map(e => [e.id!, e]));

            // Identify edges to delete
            const toDeleteEdgeIds = existingEdges.filter(e => !providedEdgeMap.has(e.id)).map(e => e.id);
            if (toDeleteEdgeIds.length > 0) {
                deleteEdgeOp = prisma.edge.deleteMany({
                    where: { id: { in: toDeleteEdgeIds } }
                });
            }

            for (const edge of providedEdges) {
                const { id: edgeId, source, target, sourceHandleId, targetHandleId, ...edgeData } = edge;

                // Map node and handle IDs (source/target are nodeIds)
                const dbSource = nodeIdMap.get(source) || source;
                const dbTarget = nodeIdMap.get(target) || target;
                const dbSourceHandleId = handleIdMap.get(sourceHandleId!) || sourceHandleId;
                const dbTargetHandleId = handleIdMap.get(targetHandleId!) || targetHandleId;

                if (!dbSource || !dbTarget || !dbSourceHandleId || !dbTargetHandleId) {
                    console.error(`Skipping edge ${edgeId}: Missing mapped IDs`, { source, target, sourceHandleId, targetHandleId });
                    continue;
                }

                const updateOrCreateData = {
                    ...edgeData,
                    source: dbSource,
                    target: dbTarget,
                    sourceHandleId: dbSourceHandleId,
                    targetHandleId: dbTargetHandleId,
                };

                if (edgeId && existingEdgeIds.has(edgeId)) {
                    // Update
                    edgeOperations.push(
                        prisma.edge.update({
                            where: { id: edgeId },
                            data: updateOrCreateData,
                        })
                    );
                } else {
                    // Create
                    const createData = updateOrCreateData;
                    if (edgeId) createData.id = edgeId;
                    edgeOperations.push(
                        prisma.edge.create({
                            data: createData,
                        })
                    );
                }
            }
        }

        // Add edge delete (after handles, but deletes are safe)
        if (deleteEdgeOp) await prisma.$transaction([deleteEdgeOp]);
        // Execute edge operations
        if (edgeOperations.length > 0) {
            await prisma.$transaction(edgeOperations);
        }

        // Step 6: Re-fetch updated canvas
        const updatedCanvas = await prisma.canvas.findFirst({
            where: { id, userId: user.id },
            include: {
                nodes: {
                    include: {
                        handles: true,
                        template: {
                            include: { templateHandles: true }
                        }
                    }
                }
            }
        });

        const updatedEdges = await prisma.edge.findMany({
            where: { sourceNode: { canvasId: id } }
        });

        if (!updatedCanvas) {
            throw new HTTPException(404, { message: 'Canvas not found' });
        }

        return c.json({
            ...updatedCanvas,
            edges: updatedEdges,
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