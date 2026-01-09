import {
	type Node,
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

export class BatchRecovery {
	private processor: NodeWFProcessor;

	constructor() {
		this.processor = new NodeWFProcessor(prisma);
	}

	async resumeDanglingBatches(): Promise<void> {
		const danglingBatches = await this.processor.prisma.taskBatch.findMany({
			where: { finishedAt: null },
			include: {
				tasks: { include: { node: true } },
			},
		});

		for (const batch of danglingBatches) {
			logger.warn(`Resuming batch: ${batch.id}`);
			try {
				await this.resumeBatch(batch);
			} catch (err: unknown) {
				const msg =
					err instanceof Error ? err.message : "Unknown recovery error";
				logger.error(`Failed to resume batch ${batch.id}: ${msg}`);
			}
		}
	}

	private async resumeBatch(
		batch: TaskBatch & { tasks: (Task & { node: Node | null })[] },
	): Promise<void> {
		const data: CanvasCtxData = await GetCanvasEntities(batch.canvasId);
		const validTasks = batch.tasks.filter(
			(t): t is Task & { node: Node; nodeId: string } =>
				t.node !== null && t.nodeId !== null,
		);

		const nodeIds = validTasks.map((t) => t.nodeId);
		const { depGraph, revDepGraph } = this.processor.buildDepGraphs(
			nodeIds,
			data,
		);
		const topoOrder = this.processor.topologicalSort(
			nodeIds,
			depGraph,
			revDepGraph,
		);

		if (!topoOrder) {
			await this.failIncompleteTasks(
				validTasks,
				"Cycle detected during recovery",
			);
			await this.finishBatch(batch.id);
			return;
		}

		const tasksMap = new Map(validTasks.map((t) => [t.nodeId, t]));
		const completed = new Set<string>(
			validTasks
				.filter((t) => t.status === TaskStatus.COMPLETED)
				.map((t) => t.nodeId),
		);
		const failed = new Set<string>(
			validTasks
				.filter((t) => t.status === TaskStatus.FAILED)
				.map((t) => t.nodeId),
		);
		const executing = new Set<string>();

		// Parallel recovery loop
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

			// If stuck (e.g. upstream failed), fail remaining
			if (readyToRun.length === 0 && executing.size === 0) {
				const remaining = topoOrder.filter(
					(id) => !completed.has(id) && !failed.has(id),
				);
				for (const id of remaining) {
					const task = tasksMap.get(id);
					if (task)
						await this.updateTaskStatus(
							task.id,
							TaskStatus.FAILED,
							"Upstream dependency failed or skipped",
						);
					failed.add(id);
				}
				break;
			}

			await Promise.all(
				readyToRun.map(async (nodeId) => {
					executing.add(nodeId);
					const task = tasksMap.get(nodeId);

					if (task) {
						try {
							// Re-run interrupted or queued tasks
							await this.processor.processTask(task.id, data, true);

							const updatedTask = await this.processor.prisma.task.findUnique({
								where: { id: task.id },
								select: { status: true },
							});

							if (updatedTask?.status === TaskStatus.COMPLETED) {
								completed.add(nodeId);
							} else {
								failed.add(nodeId);
							}
						} catch (err: unknown) {
							failed.add(nodeId);
							logger.error(`Recovery task execution failed: ${nodeId}`, err);
						}
					}
					executing.delete(nodeId);
				}),
			);
		}

		await this.finishBatch(batch.id);
	}

	private async updateTaskStatus(
		taskId: string,
		status: TaskStatus,
		errorMsg: string,
	) {
		const now = new Date();
		await this.processor.prisma.task.update({
			where: { id: taskId },
			data: {
				status,
				startedAt: now,
				finishedAt: now,
				error: { message: errorMsg },
			},
		});
	}

	private async failIncompleteTasks(tasks: Task[], message: string) {
		for (const task of tasks) {
			if (
				task.status !== TaskStatus.COMPLETED &&
				task.status !== TaskStatus.FAILED
			) {
				await this.updateTaskStatus(task.id, TaskStatus.FAILED, message);
			}
		}
	}

	private async finishBatch(batchId: string): Promise<void> {
		await this.processor.prisma.taskBatch.update({
			where: { id: batchId },
			data: { finishedAt: new Date() },
		});
	}
}
