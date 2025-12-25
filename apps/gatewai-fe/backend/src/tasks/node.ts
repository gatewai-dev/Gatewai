import type { FileData, NodeResult, Output, Task } from '@gatewai/types';
import { PrismaClient, NodeType, DataType, TaskStatus } from '@gatewai/db';
import { GetCanvasEntities, getInputValue, type CanvasCtxData } from '../repositories/canvas.js';
import { generateText, type ModelMessage, type TextPart, type UserContent } from 'ai';
import { xai } from '../ai/xai.js';
import { type User } from "better-auth";

type NodeProcessorCtx = {
  node: CanvasCtxData["nodes"][number]
  data: CanvasCtxData;
  prisma: PrismaClient;
}

type NodeProcessor = (ctx: NodeProcessorCtx) => Promise<{ success: boolean, error?: string }>;

const processors: Partial<Record<NodeType, NodeProcessor>> = {
  [NodeType.LLM]: async ({ node, data, prisma }) => {
    try {
      console.log('RUNNING LLM PROCESSOR')
      const systemPrompt = getInputValue(data, node.id, false, { dataType: DataType.Text, label: 'System Prompt' }) as string | null;
      const userPrompt = getInputValue(data, node.id, true, { dataType: DataType.Text, label: 'Prompt' }) as string;
      const imageFileData = getInputValue(data, node.id, false, { dataType: DataType.Image, label: 'Image' }) as FileData | null;
      console.log({userPrompt})
      // Build messages
      const messages: ModelMessage[] = [];

      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }

      const userContent: UserContent = [];

      if (userPrompt) {
        const textPart: TextPart = {
          type: 'text',
          text: userPrompt
        }
        userContent.push(textPart);
      }
      if (imageFileData?.entity?.signedUrl) {
        userContent.push({type: 'image', image: imageFileData?.entity?.signedUrl});
      }

      if (userContent.length === 0) {
        return { success: false, error: 'No user prompt or image provided' };
      }

      messages.push({
        role: 'user',
        content:
          userContent.length === 1 && typeof userContent[0] === 'string'
            ? (userContent[0] as string)
            : userContent,
      });

      const result = await generateText({
        model: xai('grok-4-1-fast-non-reasoning'),
        messages,
      });
      console.log({result})

      const outputHandle = data.handles.find(
        (h) => h.nodeId === node.id && h.type === 'Output'
      );
      if (!outputHandle) throw new Error('Output handle is missing');

      const prevResult = (node.result as NodeResult) ?? {
        outputs: [],
        selectedOutputIndex: 0,
      };
      const newResult =  structuredClone(prevResult);

      const newGeneration: Output = {
        items: [
          {
            type: DataType.Text,
            data: result.text,
            outputHandleId: outputHandle.id,
          },
        ],
      };

      newResult.outputs.push(newGeneration);
      newResult.selectedOutputIndex = newResult.outputs.length - 1;

      await prisma.node.update({
        where: { id: node.id },
        data: { result: newResult as NodeResult },
      });

      return { success: true };
    } catch (err: unknown) {
      if (err instanceof Error) {
        return { success: false, error: err?.message ?? 'LLM processing failed' };
      }
      return { success: false, error: 'LLM processing failed' };
    }
  },
};

export class NodeWFProcessor {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Build dependency graphs within selected nodes.
  private buildDepGraphs(
    nodeIds: string[],
    data: CanvasCtxData
  ): {
    depGraph: Map<string, string[]>; // nodeId -> downstream selected nodeIds
    revDepGraph: Map<string, string[]>; // nodeId -> upstream selected nodeIds
  } {
    const selectedSet = new Set(nodeIds);
    const depGraph = new Map<string, string[]>();
    const revDepGraph = new Map<string, string[]>();

    nodeIds.forEach(id => {
      depGraph.set(id, []);
      revDepGraph.set(id, []);
    });

    for (const edge of data.edges) {
      if (selectedSet.has(edge.source) && selectedSet.has(edge.target)) {
        depGraph.get(edge.source)!.push(edge.target);
        revDepGraph.get(edge.target)!.push(edge.source);
      }
    }

    return { depGraph, revDepGraph };
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
    return null;
  }

  public async processSelectedNodes(canvasId: string, nodeIds: string[], user: User): Promise<Task[]> {
    const data = await GetCanvasEntities(canvasId, user);

    if (nodeIds.length === 0) return [];

    const selectedSet = new Set(nodeIds);

    // Validate selected nodes exist
    const selectedNodes = data.nodes.filter(n => selectedSet.has(n.id));
    if (selectedNodes.length !== nodeIds.length) {
      throw new Error('Some selected nodes not found in canvas.');
    }

    // Build dependency graphs within selected
    const { depGraph, revDepGraph } = this.buildDepGraphs(nodeIds, data);

    const topoOrder = this.topologicalSort(nodeIds, depGraph, revDepGraph);
    if (!topoOrder) {
      throw new Error('Cycle detected in selected nodes.');
    }

    const tasks = [];

    for (const nodeId of topoOrder) {
      console.log({topoOrder})
      const node = data.nodes.find(n => n.id === nodeId)!;
      const processor = processors[node.type];
      if (!processor) {
        throw new Error(`No processor for node type ${node.type}.`);
      }

      // Create task before processing
      const task = await this.prisma.task.create({
        data: {
          name: `Process node ${node.name || node.id}`,
          canvasId,
          nodeId,
          userId: user.id,
          status: TaskStatus.EXECUTING,
          startedAt: new Date(),
          isTest: false,
        },
        include: {
          node: true,
        },
      });

      tasks.push(task);

      // Call processor without awaiting
      processor({ node, data, prisma: this.prisma })
        .then(async (result) => {
          console.log({result});
          const finishedAt = new Date();
          await this.prisma.task.update({
            where: { id: task.id },
            data: {
              status: result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
              finishedAt,
              durationMs: finishedAt.getTime() - task.startedAt!.getTime(),
              error: result.error ? { message: result.error } : null,
            },
          });
        })
        .catch(async (err: unknown) => {
          console.log({err});
          const finishedAt = new Date();
          await this.prisma.task.update({
            where: { id: task.id },
            data: {
              status: TaskStatus.FAILED,
              finishedAt,
              durationMs: finishedAt.getTime() - task.startedAt!.getTime(),
              error: err instanceof Error ? { message: err.message } : { message: 'Unknown error' },
            },
          });
        });
    }

    return tasks;
  }
}