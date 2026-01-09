import {
	type Node,
	type PrismaClient,
	prisma,
	type Task,
	type TaskBatch,
	TaskStatus,
} from "@gatewai/db";
import { logger } from "../logger.js";
import {
	type CanvasCtxData,
	GetCanvasEntities,
} from "../repositories/canvas.js";
import { NodeWFProcessor } from "./canvas-workflow-processor.js";

/**
 * This class re-runs the workflow batches that are not completed
 * Whether they are completed with error or success
 *
 * This process should only run only once on app start
 * and should be updated if horizontal scaling required.
 */
export class BatchRecovery {
	private processor: NodeWFProcessor;

	constructor() {
		this.processor = new NodeWFProcessor(prisma);
	}

	async resumeDanglingBatches(): Promise<void> {
		const danglingBatches = await this.processor.prisma.taskBatch.findMany({
			where: { finishedAt: null },
			include: {
				tasks: {
					include: {
						node: {
							select: {
								id: true,
								type: true,
								name: true,
							},
						},
					},
				},
			},
		});

		logger.warn(`Number of dangling batches: ${danglingBatches?.length ?? 0}`);
		for (const batch of danglingBatches) {
			logger.warn(`Resuming batch with ID: ${batch.id}`);
			await this.resumeBatch(batch);
		}
	}

	private async resumeBatch(
		batch: TaskBatch & {
			tasks: (Task & {
				node: Pick<Node, "id" | "type" | "name"> | null;
			})[];
		},
	): Promise<void> {
		const tasks = batch.tasks;

		// Fetch current canvas data
		const data: CanvasCtxData = await GetCanvasEntities(batch.canvasId);

		// Filter valid tasks where node still exists
		const validTasks = tasks.filter(
			(
				t,
			): t is Task & {
				node: Pick<Node, "id" | "type" | "name">;
				nodeId: string;
			} => t.node !== null && t.nodeId !== null,
		);

		const nodeIds: string[] = validTasks.map((t) => t.nodeId);

		if (nodeIds.length === 0) {
			await this.finishBatch(batch.id);
			return;
		}

		// Build dependency graphs
		const { depGraph, revDepGraph } = this.processor.buildDepGraphs(
			nodeIds,
			data,
		);

		// Perform topological sort
		const topoOrder = this.processor.topologicalSort(
			nodeIds,
			depGraph,
			revDepGraph,
		);
		if (!topoOrder) {
			// Fail all non-completed tasks due to cycle
			for (const task of validTasks) {
				if (task.status !== TaskStatus.COMPLETED) {
					const now = new Date();
					await this.processor.prisma.task.update({
						where: { id: task.id },
						data: {
							status: TaskStatus.FAILED,
							startedAt: now,
							finishedAt: now,
							durationMs: 0,
							error: { message: "Cycle detected in dependency graph" },
						},
					});
				}
			}
			await this.finishBatch(batch.id);
			return;
		}

		// Create map for quick task lookup
		const tasksMap = new Map<string, (typeof validTasks)[number]>(
			validTasks.map((t) => [t.nodeId, t]),
		);

		// Process tasks in topological order, skipping completed ones and checking upstreams
		for (const nodeId of topoOrder) {
			const task = tasksMap.get(nodeId);
			if (!task) continue;

			if (
				task.status === TaskStatus.COMPLETED ||
				task.status === TaskStatus.FAILED
			)
				continue;

			// Verify all upstream tasks are completed
			const upstreamIds = revDepGraph.get(nodeId) ?? [];
			const allUpstreamsCompleted = upstreamIds.every(
				(u) => tasksMap.get(u)?.status === TaskStatus.COMPLETED,
			);

			if (!allUpstreamsCompleted) {
				const now = new Date();
				await this.processor.prisma.task.update({
					where: { id: task.id },
					data: {
						status: TaskStatus.FAILED,
						startedAt: now,
						finishedAt: now,
						durationMs: 0,
						error: { message: "Upstream task(s) failed or incomplete" },
					},
				});
				continue;
			}

			// Process the task (assume explicitly selected for recovery)
			await this.processor.processTask(task.id, data, true);
		}

		// Finish the batch
		await this.finishBatch(batch.id);
	}

	private async finishBatch(batchId: TaskBatch["id"]): Promise<void> {
		const finishedAt = new Date();
		await this.processor.prisma.taskBatch.update({
			where: { id: batchId },
			data: { finishedAt },
		});
	}
}
