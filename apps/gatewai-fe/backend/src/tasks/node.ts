import type { NodeResult } from '@gatewai/types';
import { PrismaClient, TaskStatus, type TaskBatch } from '@gatewai/db';
import { GetCanvasEntities, type CanvasCtxData } from '../repositories/canvas.js';
import { type User } from "better-auth";
import { nodeProcessors } from './processors/index.js';

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

  public async processSelectedNodes(canvasId: string, nodeIds: string[], user: User): Promise<TaskBatch> {
    const data = await GetCanvasEntities(canvasId, user);  // Load once, update in-memory as we go

    if (nodeIds.length === 0) {
      throw new Error("No node selected to process.");
    }

    const batch = await this.prisma.taskBatch.create({
      data: {
        userId: user.id,
        canvasId,
      },
    });

    const allNodeIds = data.nodes.map(n => n.id);
    const { revDepGraph: fullRevDepGraph } = this.buildDepGraphs(allNodeIds, data);

    // Find all necessary nodes: selected + all upstream dependencies
    const necessary = new Set<string>();
    const queue: string[] = [...nodeIds];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (necessary.has(curr)) continue;
      necessary.add(curr);
      const ups = fullRevDepGraph.get(curr) || [];
      queue.push(...ups);
    }

    const necessaryIds = Array.from(necessary);

    // Build subgraph for necessary nodes
    const { depGraph, revDepGraph } = this.buildDepGraphs(necessaryIds, data);

    const topoOrder = this.topologicalSort(necessaryIds, depGraph, revDepGraph);
    if (!topoOrder) {
      throw new Error('Cycle detected in necessary nodes.');
    }

    // Validate necessary nodes exist
    const necessaryNodes = data.nodes.filter(n => necessary.has(n.id));
    if (necessaryNodes.length !== necessary.size) {
      throw new Error('Some necessary nodes not found in canvas.');
    }

    const executer = async () => {
      for (const nodeId of topoOrder) {
        const node = data.nodes.find(n => n.id === nodeId)!;  // Use current in-memory data
        const template = await this.prisma.nodeTemplate.findUnique({ where: { type: node.type } });  // Fetch template for isTransient
        const processor = nodeProcessors[node.type];
        if (!processor) {
          throw new Error(`No processor for node type ${node.type}.`);
        }

        // Create task before processing
        const task = await this.prisma.task.create({
          data: {
            name: `Process node ${node.name || node.id}`,
            nodeId,
            status: TaskStatus.EXECUTING,
            startedAt: new Date(),
            isTest: false,
            batchId: batch.id,
          },
        });

        try {
          // Await processor, pass current data
          const { success, error, newResult } = await processor({ node, data, prisma: this.prisma });

          if (newResult) {
            // Update in-memory data for propagation to downstream nodes
            const updatedNode = data.nodes.find(n => n.id === nodeId)!;
            updatedNode.result = structuredClone(newResult);
          }

          const finishedAt = new Date();
          await this.prisma.task.update({
            where: { id: task.id },
            data: {
              status: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
              finishedAt,
              durationMs: finishedAt.getTime() - task.startedAt!.getTime(),
              error: error ? { message: error } : null,
            },
          });

          // Persist to DB only if not transient
          if (success && !template?.isTransient && newResult) {
            await this.prisma.node.update({
              where: { id: node.id },
              data: { result: newResult as NodeResult },
            });
          }
        } catch (err: unknown) {
          console.log({ err });
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
        }
      }

      const batchFinishedAt = new Date();
      await this.prisma.taskBatch.update({
        where: { id: batch.id },
        data: { finishedAt: batchFinishedAt },
        include: { tasks: true },
      });
    }

    executer();

    return batch;
  }
}