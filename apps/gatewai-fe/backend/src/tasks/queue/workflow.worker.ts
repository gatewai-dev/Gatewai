import { type Prisma, prisma, TaskStatus } from "@gatewai/db";
import { type Job, Worker } from "bullmq";
import { logger } from "../../logger.js";
import { GetCanvasEntities } from "../../repositories/canvas.js";
import { assertIsError } from "../../utils/misc.js";
import { nodeProcessors } from "../processors/index.js";
import { redisConnection } from "./connection.js";
import {
	type NodeTaskJobData,
	WORKFLOW_QUEUE_NAME,
	workflowQueue,
} from "./workflow.queue.js";

// Global reference for shutdown handling
let worker: Worker<NodeTaskJobData> | null = null;

const processNodeJob = async (job: Job<NodeTaskJobData>) => {
	const {
		taskId,
		canvasId,
		batchId,
		remainingTaskIds,
		isExplicitlySelected,
		selectionMap,
	} = job.data;

	const startedAt = new Date();

	// [Idempotency Check]
	// If the job was retried after a crash, the task might already be in a terminal state
	// or technically "EXECUTING" from the previous run.
	const existingTask = await prisma.task.findUnique({
		where: { id: taskId },
		select: { status: true },
	});

	if (existingTask?.status === TaskStatus.COMPLETED) {
		logger.info(`Task ${taskId} already completed. Skipping execution.`);
		// Trigger next just in case the previous run crashed *after* success but *before* triggering next
		await triggerNextTask(batchId, remainingTaskIds, selectionMap, canvasId);
		return;
	}

	// 1. Update Task Status to EXECUTING
	// We use updateMany here to ensure we don't overwrite a terminal state if a race condition occurs
	await prisma.task.update({
		where: { id: taskId },
		data: {
			status: TaskStatus.EXECUTING,
			startedAt,
		},
	});

	try {
		// 2. Fetch fresh Context Data
		const data = await GetCanvasEntities(canvasId);

		// 3. Fetch current task details
		const task = await prisma.task.findUniqueOrThrow({
			where: { id: taskId },
			select: { nodeId: true },
		});

		if (!task.nodeId)
			throw new Error(`Task ${taskId} has no associated nodeId`);

		// 4. Validate Node Exists
		const currentNode = await prisma.node.findUnique({
			where: { id: task.nodeId },
			select: { id: true, type: true, name: true },
		});

		if (!currentNode) throw new Error("Node removed before processing");

		const node = data.nodes.find((n) => n.id === task.nodeId);
		if (!node) throw new Error("Node not found in canvas entities");

		const template = await prisma.nodeTemplate.findUniqueOrThrow({
			where: { type: currentNode.type },
		});

		// 5. Check Terminal Node Logic
		const isTerminal = template.isTerminalNode;
		if (isTerminal && !isExplicitlySelected) {
			logger.info(`Skipping processing for terminal node: ${node.id}`);
			await completeTask(taskId, startedAt, true);
			await triggerNextTask(batchId, remainingTaskIds, selectionMap, canvasId);
			return;
		}

		const batchTasks = await prisma.task.findMany({
			where: { batchId },
		});

		// 6. Execute Processor
		const processor = nodeProcessors[node.type];
		if (!processor) throw new Error(`No processor for node type ${node.type}`);

		logger.info(`Processing node: ${node.id} with type: ${node.type}`);
		const { success, error, newResult } = await processor({
			node,
			data: { ...data, tasks: batchTasks },
			prisma,
		});

		if (error) logger.error(`${node.id}: Error: ${error}`);

		// 7. Handle Results
		if (newResult) {
			await prisma.task.update({
				where: { id: taskId },
				data: { result: newResult as unknown as Prisma.InputJsonValue },
			});

			if (success && !template.isTransient) {
				// Wrap in try-catch to avoid failing the task if just the node update fails
				try {
					await prisma.node.update({
						where: { id: node.id },
						data: { result: newResult as unknown as Prisma.InputJsonValue },
					});
				} catch (_updateErr) {
					logger.warn(
						`Failed to update node result for ${node.id}, continuing...`,
					);
				}
			}
		}

		// 8. Finalize Task
		const finishedAt = new Date();
		await prisma.task.update({
			where: { id: taskId },
			data: {
				status: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
				finishedAt,
				durationMs: finishedAt.getTime() - startedAt.getTime(),
				error: error ? { message: error } : undefined,
			},
		});

		if (success) {
			await triggerNextTask(batchId, remainingTaskIds, selectionMap, canvasId);
		} else {
			await failBatch(batchId);
		}
	} catch (err: unknown) {
		logger.error({ err }, `Task execution failed for ${taskId}`);
		const finishedAt = new Date();
		const errorMessage = err instanceof Error ? err.message : "Unknown error";

		await prisma.task.update({
			where: { id: taskId },
			data: {
				status: TaskStatus.FAILED,
				finishedAt,
				durationMs: finishedAt.getTime() - startedAt.getTime(),
				error: { message: errorMessage },
			},
		});

		await failBatch(batchId);
		throw err;
	}
};

async function failBatch(batchId: string) {
	try {
		await prisma.taskBatch.update({
			where: { id: batchId },
			data: { finishedAt: new Date() },
		});
	} catch (e) {
		logger.warn(`Could not mark batch ${batchId} as failed`, e);
	}
}

async function triggerNextTask(
	batchId: string,
	remainingTaskIds: string[],
	selectionMap: Record<string, boolean>,
	canvasId: string,
) {
	if (remainingTaskIds.length === 0) {
		await prisma.taskBatch.update({
			where: { id: batchId },
			data: { finishedAt: new Date() },
		});
		return;
	}

	const [nextTaskId, ...rest] = remainingTaskIds;
	const isSelected = selectionMap[nextTaskId] ?? false;

	// Use the queue instance imported from workflow.queue.js
	await workflowQueue.add("process-node", {
		taskId: nextTaskId,
		canvasId,
		batchId,
		remainingTaskIds: rest,
		isExplicitlySelected: isSelected,
		selectionMap,
	});
}

async function completeTask(taskId: string, startedAt: Date, success: boolean) {
	const finishedAt = new Date();
	await prisma.task.update({
		where: { id: taskId },
		data: {
			status: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
			finishedAt,
			durationMs: finishedAt.getTime() - startedAt.getTime(),
		},
	});
}

/**
 * Recovers Zembie tasks that were left in EXECUTING state
 * due to a sudden process kill (SIGKILL/5s timeout).
 */
export async function recoverDanglingTasks() {
	logger.info("Starting startup recovery check...");

	// 1. Find all tasks stuck in EXECUTING
	const danglingTasks = await prisma.task.findMany({
		where: {
			status: TaskStatus.EXECUTING,
		},
		include: {
			batch: true,
		},
	});

	if (danglingTasks.length === 0) {
		logger.info("No dangling tasks found.");
		return;
	}

	for (const task of danglingTasks) {
		const job = await workflowQueue.getJob(task.id);

		const isActive = job && (await job.isActive());

		if (!isActive) {
			logger.warn(`Recovering zombie task ${task.id}: marking as FAILED.`);

			await prisma.$transaction([
				prisma.task.update({
					where: { id: task.id },
					data: {
						status: TaskStatus.FAILED,
						finishedAt: new Date(),
						error: { message: "Task abandoned due to system restart/crash." },
					},
				}),
				// 3. Stop the batch so the chain doesn't continue with broken data
				prisma.taskBatch.update({
					where: { id: task.batchId },
					data: { finishedAt: new Date() },
				}),
			]);
		}
	}

	logger.info(
		`Recovery check complete. Cleaned up ${danglingTasks.length} tasks.`,
	);
}

const TEN_MINS = 600_000;

export const startWorker = async () => {
	logger.info("Starting Workflow Worker...");

	try {
		await recoverDanglingTasks();
	} catch (err) {
		assertIsError(err);
		logger.error(`Failed to run startup recovery, ${err.message}`);
		// We continue anyway so the worker can still process new jobs
	}

	worker = new Worker<NodeTaskJobData>(WORKFLOW_QUEUE_NAME, processNodeJob, {
		connection: redisConnection,
		concurrency: 5,
		lockDuration: TEN_MINS,
	});

	worker.on("failed", async (job, err) => {
		logger.error(`${job?.id} failed permanently: ${err.message}`);
		if (job?.data) {
			const { taskId, batchId } = job.data;

			try {
				await prisma.task.update({
					where: { id: taskId },
					data: {
						status: TaskStatus.FAILED,
						finishedAt: new Date(),
						error: { message: `Job failed/stalled: ${err.message}` },
					},
				});
				await failBatch(batchId);
			} catch (dbErr) {
				logger.error(`Failed to sync DB state on worker job failure ${dbErr}`);
			}
		}
	});

	worker.on("completed", (job) => logger.info(`${job.id} has completed!`));
	worker.on("error", (err) => logger.error(`Worker error: ${err.message}`));

	const gracefulShutdown = async (signal: string) => {
		logger.info(`Received ${signal}, shutting down worker...`);

		if (worker) {
			await worker.close();
			logger.info("Worker closed.");
		}

		await workflowQueue.close();
		await prisma.$disconnect();

		logger.info("Shutdown complete.");
		process.exit(0);
	};

	process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
	process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};
