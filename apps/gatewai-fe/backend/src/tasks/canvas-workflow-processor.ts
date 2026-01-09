import {
	type Canvas,
	type Node,
	type PrismaClient,
	type Task,
	type TaskBatch,
	TaskStatus,
} from "@gatewai/db";
import type { NodeResult } from "@gatewai/types";
import { logger } from "../logger.js";
import {
	type CanvasCtxData,
	GetCanvasEntities,
} from "../repositories/canvas.js";
import { nodeProcessors } from "./processors/index.js";

export class NodeWFProcessor {
	constructor(public prisma: PrismaClient) {}

	public buildDepGraphs(
		nodeIds: Node["id"][],
		data: CanvasCtxData,
	): {
		depGraph: Map<Node["id"], Node["id"][]>;
		revDepGraph: Map<Node["id"], Node["id"][]>;
	} {
		const selectedSet = new Set(nodeIds);
		const depGraph = new Map<Node["id"], Node["id"][]>();
		const revDepGraph = new Map<Node["id"], Node["id"][]>();

		for (const id of nodeIds) {
			depGraph.set(id, []);
			revDepGraph.set(id, []);
		}

		for (const edge of data.edges) {
			if (selectedSet.has(edge.source) && selectedSet.has(edge.target)) {
				depGraph.get(edge.source)?.push(edge.target);
				revDepGraph.get(edge.target)?.push(edge.source);
			}
		}

		return { depGraph, revDepGraph };
	}

	public topologicalSort(
		nodes: string[],
		depGraph: Map<Node["id"], Node["id"][]>,
		revDepGraph: Map<Node["id"], Node["id"][]>,
	): string[] | null {
		const indegree = new Map(
			nodes.map((id) => [id, revDepGraph.get(id)?.length ?? 0]),
		);
		const queue = nodes.filter((id) => indegree.get(id) === 0);
		const order: Node["id"][] = [];

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) continue;

			order.push(current);

			for (const ds of depGraph.get(current) || []) {
				const deg = (indegree.get(ds) ?? 0) - 1;
				indegree.set(ds, deg);
				if (deg === 0) queue.push(ds);
			}
		}

		return order.length === nodes.length ? order : null;
	}

	private async hydrateContext(data: CanvasCtxData, nodeId: string) {
		const nodeInDb = await this.prisma.node.findUnique({
			where: { id: nodeId },
			select: { result: true },
		});
		const nodeInCtx = data.nodes.find((n) => n.id === nodeId);
		if (nodeInCtx && nodeInDb?.result) {
			nodeInCtx.result = nodeInDb.result as unknown as NodeResult;
		}
	}

	public async processTask(
		taskId: Task["id"],
		data: CanvasCtxData,
		isExplicitlySelected: boolean,
	): Promise<void> {
		const startedAt = new Date();

		const task = await this.prisma.task.findUniqueOrThrow({
			where: { id: taskId },
			include: { node: true },
		});

		if (!task.nodeId || !task.node) {
			throw new Error(`Task/Node link missing for task ${taskId}`);
		}

		await this.prisma.task.update({
			where: { id: taskId },
			data: { status: TaskStatus.EXECUTING, startedAt },
		});

		const template = await this.prisma.nodeTemplate.findUniqueOrThrow({
			where: { type: task.node.type },
		});

		if (template.isTerminalNode && !isExplicitlySelected) {
			const finishedAt = new Date();
			await this.prisma.task.update({
				where: { id: taskId },
				data: {
					status: TaskStatus.COMPLETED,
					finishedAt,
					durationMs: finishedAt.getTime() - startedAt.getTime(),
				},
			});
			return;
		}

		const processor = nodeProcessors[task.node.type];
		if (!processor) {
			throw new Error(`No processor found for node type: ${task.node.type}`);
		}

		try {
			// Ensure upstream results are hydrated before execution
			await Promise.all(data.nodes.map((n) => this.hydrateContext(data, n.id)));

			const targetNode = data.nodes.find((n) => n.id === task.nodeId);
			if (!targetNode) throw new Error("Node not found in context data");

			const { success, error, newResult } = await processor({
				node: targetNode,
				data,
				prisma: this.prisma,
			});

			const finishedAt = new Date();

			if (success && !template.isTransient && newResult) {
				await this.prisma.node.update({
					where: { id: task.nodeId },
					data: { result: newResult as NodeResult },
				});
				if (targetNode) targetNode.result = newResult as NodeResult;
			}

			await this.prisma.task.update({
				where: { id: taskId },
				data: {
					status: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
					finishedAt,
					durationMs: finishedAt.getTime() - startedAt.getTime(),
					error: error ? { message: error } : undefined,
				},
			});
		} catch (err: unknown) {
			const finishedAt = new Date();
			const errorMessage =
				err instanceof Error ? err.message : "Unknown error occurred";

			await this.prisma.task.update({
				where: { id: taskId },
				data: {
					status: TaskStatus.FAILED,
					finishedAt,
					durationMs: finishedAt.getTime() - startedAt.getTime(),
					error: { message: errorMessage },
				},
			});
		}
	}

	public async processNodes(
		canvasId: Canvas["id"],
		nodeIds?: Node["id"][],
	): Promise<TaskBatch & { tasks: (Task & { node: Node | null })[] }> {
		const data = await GetCanvasEntities(canvasId);

		// 1. Dependency Analysis & Pruning
		const allNodeIds = data.nodes.map((n) => n.id);
		const { revDepGraph: fullRevDepGraph } = this.buildDepGraphs(
			allNodeIds,
			data,
		);

		const nodeIdsToRun = nodeIds ?? allNodeIds;
		const necessary = new Set<Node["id"]>();
		const queue = [...nodeIdsToRun];

		while (queue.length > 0) {
			const curr = queue.shift();
			if (!curr || necessary.has(curr)) continue;
			necessary.add(curr);
			queue.push(...(fullRevDepGraph.get(curr) || []));
		}

		const templates = await this.prisma.nodeTemplate.findMany({
			where: {
				type: { in: Array.from(new Set(data.nodes.map((n) => n.type))) },
			},
		});
		const terminalTypes = new Set(
			templates.filter((t) => t.isTerminalNode).map((t) => t.type),
		);

		const filteredNecessary = Array.from(necessary).filter((id) => {
			const node = data.nodes.find((n) => n.id === id);
			return (
				nodeIdsToRun.includes(id) || (node && !terminalTypes.has(node.type))
			);
		});

		const { depGraph, revDepGraph } = this.buildDepGraphs(
			filteredNecessary,
			data,
		);
		const topoOrder = this.topologicalSort(
			filteredNecessary,
			depGraph,
			revDepGraph,
		);
		if (!topoOrder) throw new Error("Cycle detected in graph");

		// 2. Atomic Batch and Task Creation
		// We use a transaction to ensure the batch is returned with its tasks fully populated
		const fullBatch = await this.prisma.$transaction(async (tx) => {
			const createdBatch = await tx.taskBatch.create({
				data: { canvasId },
			});

			const taskCreations = topoOrder.map((nodeId) => {
				const node = data.nodes.find((n) => n.id === nodeId);
				return tx.task.create({
					data: {
						name: `Process node ${node?.name || nodeId}`,
						nodeId,
						status: TaskStatus.QUEUED,
						batchId: createdBatch.id,
					},
					include: { node: true }, // Ensure node is included for the frontend
				});
			});

			const tasks = await Promise.all(taskCreations);

			return {
				...createdBatch,
				tasks,
			};
		});

		// Create a lookup for the background processor
		const tasksMap = new Map(fullBatch.tasks.map((t) => [t.nodeId!, t.id]));

		// 3. Background Execution (Fire and Forget)
		this.runBackgroundWorkflow(
			fullBatch.id,
			topoOrder,
			tasksMap,
			data,
			revDepGraph,
			nodeIdsToRun,
		);

		return fullBatch;
	}

	/**
	 * Abstracted background logic for cleaner code structure
	 */
	private async runBackgroundWorkflow(
		batchId: string,
		topoOrder: string[],
		tasksMap: Map<string, string>,
		data: CanvasCtxData,
		revDepGraph: Map<string, string[]>,
		nodeIdsToRun: string[],
	) {
		const completed = new Set<string>();
		const executing = new Set<string>();
		const failed = new Set<string>();

		try {
			while (completed.size + failed.size < topoOrder.length) {
				const readyToRun = topoOrder.filter((nodeId) => {
					if (
						completed.has(nodeId) ||
						executing.has(nodeId) ||
						failed.has(nodeId)
					)
						return false;
					const upstreams = revDepGraph.get(nodeId) ?? [];
					return upstreams.every((u) => completed.has(u));
				});

				if (readyToRun.length === 0 && executing.size === 0) break;

				await Promise.all(
					readyToRun.map(async (nodeId) => {
						executing.add(nodeId);
						const taskId = tasksMap.get(nodeId);
						if (taskId) {
							try {
								const isExplicit = nodeIdsToRun.includes(nodeId);
								await this.processTask(taskId, data, isExplicit);

								const task = await this.prisma.task.findUnique({
									where: { id: taskId },
									select: { status: true },
								});

								if (task?.status === TaskStatus.COMPLETED) {
									completed.add(nodeId);
								} else {
									failed.add(nodeId);
								}
							} catch (e) {
								failed.add(nodeId);
								logger.error(`[Workflow] Task failed: ${nodeId}`, e);
							}
						}
						executing.delete(nodeId);
					}),
				);
			}
		} catch (err) {
			logger.error("[Workflow] Critical background failure", err);
		} finally {
			await this.prisma.taskBatch.update({
				where: { id: batchId },
				data: { finishedAt: new Date() },
			});
		}
	}
}
