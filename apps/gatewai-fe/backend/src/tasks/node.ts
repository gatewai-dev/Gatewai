import type { FileData, NodeResult, Output } from '@gatewai/types';
import { PrismaClient, type Node as PrismaNode, type Edge as PrismaEdge, type Handle as PrismaHandle, NodeType, DataType, TaskStatus, Prisma } from '@gatewai/db';
import type { CanvasCtxData } from '../repositories/canvas.js';
import { generateText, type ModelMessage } from 'ai';
import { xai } from '../ai/xai.js';

type NodeProcessorCtx = {
  node: CanvasCtxData["nodes"][number]
  data: CanvasCtxData;
  prisma: PrismaClient;
}
// Assuming a separate processor map for node types. In a real system, this would be implemented or injected.
type NodeProcessor = (ctx: NodeProcessorCtx) => Promise<{success: boolean, error?: string}>;

// Placeholder processors map. Implement actual logic for each NodeType as needed.
// TODO: cleanup with helper functions
const processors: Partial<Record<NodeType, NodeProcessor>> = {
  // Example for Text node: Outputs config.text or something similar.
  [NodeType.LLM]: async ({node, data, prisma}) => {
    const connectedEdges = data.edges.filter(f => f.target === node.id);
    const textEdge = connectedEdges.find(f => f.dataType === 'Text');
    if (!textEdge) {
      return { success: false }
    }
    const textEdgeHandle = data.handles.find(f => f.id === textEdge.sourceHandleId);
    const textSourceNode = data.nodes.find(f => f.id === textEdgeHandle?.nodeId);
    const nodeResult = textSourceNode?.result as NodeResult;
    const outputInstance = nodeResult.outputs[nodeResult.selectedOutputIndex];
    const outputItem = outputInstance.items.find(f => f.outputHandleId === textEdge.sourceHandleId);
    const promptValue = outputItem?.data as string
    const messages: ModelMessage[] = [{role: 'user', content: promptValue}];


    const imageEdge = connectedEdges.find(f => f.dataType === 'Text');

    // If an image is connected to node, add it to payload.
    if (imageEdge != null) {
      const imageEdge = connectedEdges.find(f => f.dataType === 'Image');
      if (!imageEdge) {
        throw new Error("Image edge could not be found.");
      }
      const imageEdgeHandle = data.handles.find(f => f.id === imageEdge.sourceHandleId);
      const imageSourceNode = data.nodes.find(f => f.id === imageEdgeHandle?.nodeId);
      const imageNodeResult = imageSourceNode?.result as NodeResult;
      const imgOutputInstance = imageNodeResult.outputs[imageNodeResult.selectedOutputIndex];
      const imgOutputItem = imgOutputInstance.items.find(f => f.outputHandleId === imageEdge.sourceHandleId);
      const fileResult = imgOutputItem?.data as FileData;
      if (!fileResult.entity.signedUrl) {
        throw new Error("Image URL could not be found.");
      }
      const message: ModelMessage = {role: 'user', content: [{type: 'image', image: fileResult.entity.signedUrl}]}

      messages.push(message);
    }

    const result = await generateText({
      model: xai('grok-4-1'),
      messages,
    });

    // There's only single output handle
    const outputHandle = data.handles.find(f => f.nodeId === node.id && f.type === 'Output')
    if (!outputHandle) {
      throw new Error("Output handle is missing");
    }
    const prevResult = node.result as NodeResult;
    const tempResult = {...prevResult};

    const newGeneration: Output = {
      items: [{type: 'Text', data: result.text, outputHandleId: outputHandle.id}]
    }

    tempResult.outputs.push(newGeneration)
    tempResult.selectedOutputIndex = tempResult.outputs.length - 1;

    // Update node and res
    await prisma.node.update({
      data: {
        result: tempResult
      },
      where: {
        id: node.id,
      }
    })

    return {
      success: true,
    };
  },
};

export class NodeWFProcessor {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Fetch selected nodes and their dependencies within the selection.
  private async fetchSelectedNodes(canvasId: string, nodeIds: string[]): Promise<{
    nodes: Map<string, PrismaNode & { handles: PrismaHandle[]; edgesFrom: PrismaEdge[]; edgesTo: PrismaEdge[] }>;
    depGraph: Map<string, string[]>; // nodeId -> downstream selected nodeIds
    revDepGraph: Map<string, string[]>; // nodeId -> upstream selected nodeIds
  }> {
    const nodes = await this.prisma.node.findMany({
      where: { id: { in: nodeIds }, canvasId },
      include: {
        handles: true,
        edgesFrom: true, // Outgoing edges (downstream)
        edgesTo: true,   // Incoming edges (upstream)
      },
    });

    if (nodes.length !== nodeIds.length) {
      throw new Error('Some selected nodes not found in canvas.');
    }

    const nodesMap = new Map(nodes.map(n => [n.id, n]));

    const depGraph = new Map<string, string[]>(); // Upstream -> downstream within selected
    const revDepGraph = new Map<string, string[]>(); // Downstream -> upstream within selected

    nodeIds.forEach(id => {
      depGraph.set(id, []);
      revDepGraph.set(id, []);
    });

    for (const node of nodes) {
      for (const edge of node.edgesFrom) {
        if (nodeIds.includes(edge.target)) {
          depGraph.get(node.id)!.push(edge.target);
          revDepGraph.get(edge.target)!.push(node.id);
        }
      }
    }

    return { nodes: nodesMap, depGraph, revDepGraph };
  }

  // Get inputs for a node.
  private async getNodeInputs(nodeId: string): Promise<Record<string, any>> {
    const node = await this.prisma.node.findUniqueOrThrow({
      where: { id: nodeId },
      include: { edgesTo: { include: { sourceNode: true, sourceHandle: true } }, handles: true },
    });

    const inputs: Record<string, any> = {};
    const inputHandles = node.handles.filter(h => h.type === 'Input');

    for (const handle of inputHandles) {
      const incomingEdge = node.edgesTo.find(e => e.targetHandleId === handle.id);
      if (incomingEdge) {
        const sourceNode = incomingEdge.sourceNode;
        if (!sourceNode.result) {
          throw new Error(`Source node ${sourceNode.id} has no result.`);
        }
        const result = sourceNode.result as { selectedOutputIndex?: number; outputs: { items: { type: DataType; data: any; outputHandleId: string }[] }[] };
        const outputIndex = result.selectedOutputIndex ?? result.outputs.length - 1;
        const output = result.outputs[outputIndex];
        const item = output.items.find(i => i.outputHandleId === incomingEdge.sourceHandleId);
        if (!item) {
          throw new Error(`Missing output item for handle ${incomingEdge.sourceHandleId}.`);
        }
        inputs[handle.id] = item.data;
      } else if (handle.required) {
        throw new Error(`Required input handle ${handle.id} has no connection.`);
      }
    }

    return inputs;
  }

  // Update node result and create task record.
  private async updateNodeResult(
    nodeId: string,
    newOutput: { items: { type: DataType; data: any; outputHandleId: string }[] },
    userId: string,
    canvasId: string
  ): Promise<void> {
    const node = await this.prisma.node.findUniqueOrThrow({ where: { id: nodeId }, include: { handles: true } });

    const result = (node.result as { selectedOutputIndex?: number; outputs: { items: { type: DataType; data: any; outputHandleId: string }[] }[] }) || { outputs: [] };
    result.outputs.push(newOutput);
    result.selectedOutputIndex = result.outputs.length - 1;

    await this.prisma.node.update({
      where: { id: nodeId },
      data: { result, isDirty: false },
    });

    // Create a task record
    await this.prisma.task.create({
      data: {
        name: `Process node ${node.name}`,
        canvasId,
        nodeId,
        userId,
        status: TaskStatus.COMPLETED,
        durationMs: 0, // Placeholder, measure actual if needed
        isTest: false,
      },
    });
  }

  // Mark downstream nodes dirty (cascading).
  private async markDownstreamDirty(nodeId: string, visited: Set<string> = new Set()): Promise<void> {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = await this.prisma.node.findUniqueOrThrow({
      where: { id: nodeId },
      include: { edgesFrom: true },
    });

    for (const edge of node.edgesFrom) {
      await this.prisma.node.update({
        where: { id: edge.target },
        data: { isDirty: true },
      });
      await this.markDownstreamDirty(edge.target, visited);
    }
  }

  public async processSelectedNodes(canvasId: string, nodeIds: string[], userId: string): Promise<void> {
    // Fetch selected nodes and build dependency graphs (within selected).
    const { nodes: nodesMap, depGraph, revDepGraph } = await this.fetchSelectedNodes(canvasId, nodeIds);

    // Topological sort of selected nodes based on dependencies.
    const topoOrder = this.topologicalSort(nodeIds, depGraph, revDepGraph);

    if (!topoOrder) {
      throw new Error('Cycle detected in selected nodes.');
    }

    // Process each node in topological order.
    for (const nodeId of topoOrder) {
      const node = nodesMap.get(nodeId)!;

      // Get current inputs (upstream may be updated if selected and processed earlier).
      const inputs = await this.getNodeInputs(nodeId);

      // Process the node (actual computation).
      const processor = processors[node.type];
      if (!processor) {
        throw new Error(`No processor for node type ${node.type}.`);
      }
      const outputData = await processor(node, inputs);

      // Map to OutputItems.
      const outputHandles = node.handles.filter(h => h.type === 'Output');
      const newOutputItems = outputHandles.map(handle => {
        const data = outputData[handle.id];
        if (!data && handle.required) {
          throw new Error(`Missing output for required handle ${handle.id}.`);
        }
        return {
          type: data?.type || handle.dataType,
          data: data?.data,
          outputHandleId: handle.id,
        };
      });
      const newOutput = { items: newOutputItems };

      // Update node result and create task.
      await this.updateNodeResult(nodeId, newOutput, userId, canvasId);

      // Mark all downstream nodes dirty (canvas-wide, not just selected).
      await this.markDownstreamDirty(nodeId);
    }
  }

  // Helper: Topological sort using Kahn's algorithm.
  private topologicalSort(nodes: string[], depGraph: Map<string, string[]>, revDepGraph: Map<string, string[]>): string[] | null {
    const indegree = new Map(nodes.map(id => [id, revDepGraph.get(id)!.length]));
    const queue = nodes.filter(id => indegree.get(id) === 0);
    const order: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);

      const downstream = depGraph.get(current) || [];
      for (const ds of downstream) {
        const deg = indegree.get(ds)! - 1;
        indegree.set(ds, deg);
        if (deg === 0) {
          queue.push(ds);
        }
      }
    }

    if (order.length === nodes.length) {
      return order;
    }
    return null; // Cycle
  }
}