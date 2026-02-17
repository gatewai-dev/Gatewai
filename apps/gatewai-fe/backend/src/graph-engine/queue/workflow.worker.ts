import { ENV_CONFIG, logger } from "@gatewai/core";
import { container } from "@gatewai/core/di";
import { GetCanvasEntities } from "@gatewai/data-ops";
import { Prisma, prisma, TaskStatus } from "@gatewai/db";
import {
	type NodeTaskJobData,
	nodeRegistry,
	redisConnection,
	WORKFLOW_QUEUE_NAME,
	workflowQueue,
} from "@gatewai/graph-engine";
import type {
	BackendNodeProcessorCtx,
	NodeProcessor,
	NodeProcessorConstructor,
} from "@gatewai/node-sdk/server";
import { type Job, Worker } from "bullmq";
import { assertIsError } from "../../utils/misc.js";

// Global reference for shutdown handling
let worker: Worker<NodeTaskJobData> | null = null;

async function checkAndFinishBatch(batchId: string) {
	try {
		const pendingCount = await prisma.task.count({
			where: {
				batchId,
				status: { in: [TaskStatus.QUEUED, TaskStatus.EXECUTING] },
			},
		});

		if (pendingCount === 0) {
			// Mark current batch as finished
			const finishedBatch = await prisma.taskBatch.update({
				where: { id: batchId },
				data: { finishedAt: new Date() },
				select: { canvasId: true },
			});

			// Check for next pending batch on the same canvas
			await dispatchNextPendingBatch(finishedBatch.canvasId);
		}
	} catch (e) {
		assertIsError(e);
		logger.warn(`Could not check and finish batch ${batchId}: ${e.message}`);
	}
}

/**
 * Find and dispatch the next pending batch for a canvas.
 * Called when a batch finishes to start the next queued one.
 */
async function dispatchNextPendingBatch(canvasId: string) {
	try {
		// Find the oldest pending batch (has pendingJobData but no startedAt)
		const nextBatch = await prisma.taskBatch.findFirst({
			where: {
				canvasId,
				pendingJobData: { not: Prisma.JsonNull },
				startedAt: null,
			},
			orderBy: { createdAt: "asc" },
		});

		if (nextBatch?.pendingJobData) {
			const jobData = nextBatch.pendingJobData as unknown as NodeTaskJobData;

			// Mark batch as started and clear pendingJobData
			await prisma.taskBatch.update({
				where: { id: nextBatch.id },
				data: {
					startedAt: new Date(),
					pendingJobData: Prisma.DbNull,
				},
			});

			// Dispatch to queue
			await workflowQueue.add("process-node", jobData);
			logger.info(
				`Dispatched pending batch ${nextBatch.id} for canvas ${canvasId}`,
			);
		}
	} catch (e) {
		assertIsError(e);
		logger.error(
			`Failed to dispatch next pending batch for canvas ${canvasId}: ${e.message}`,
		);
	}
}

async function propagateFailure(
	taskId: string,
	batchId: string,
	failedNodeIdentifier: string,
	errorMessage: string,
) {
	async function recurse(currentTaskId: string) {
		const currentTask = await prisma.task.findUnique({
			where: { id: currentTaskId },
			select: { nodeId: true },
		});
		if (!currentTask?.nodeId) return;

		const outgoingEdges = await prisma.edge.findMany({
			where: { source: currentTask.nodeId },
			select: { target: true },
		});

		const downstreamNodeIds = outgoingEdges.map((e) => e.target);

		const downstreamTasks = await prisma.task.findMany({
			where: {
				nodeId: { in: downstreamNodeIds },
				batchId,
				status: { in: [TaskStatus.QUEUED, TaskStatus.EXECUTING] },
			},
			select: { id: true, status: true, startedAt: true },
		});

		for (const dt of downstreamTasks) {
			const finishedAt = new Date();
			const durationMs =
				dt.status === TaskStatus.EXECUTING && dt.startedAt
					? finishedAt.getTime() - dt.startedAt.getTime()
					: 0;

			await prisma.task.update({
				where: { id: dt.id },
				data: {
					status: TaskStatus.FAILED,
					finishedAt,
					durationMs,
					error: {
						message: `Upstream failure in node ${failedNodeIdentifier}: ${errorMessage}`,
					},
				},
			});

			await recurse(dt.id);
		}
	}

	await recurse(taskId);
}

const processNodeJob = async (job: Job<NodeTaskJobData>) => {
	const {
		taskId,
		canvasId,
		batchId,
		remainingTaskIds,
		isExplicitlySelected,
		selectionMap,
		apiKey,
	} = job.data;

	const startedAt = new Date();

	// If the job was retried after a crash, the task might already be in a terminal state
	// or technically "EXECUTING" from the previous run.
	const existingTask = await prisma.task.findUnique({
		where: { id: taskId },
		select: { status: true },
	});

	if (existingTask?.status === TaskStatus.COMPLETED) {
		logger.info(`Task ${taskId} already completed. Skipping execution.`);
		// Trigger next just in case the previous run crashed *after* success but *before* triggering next
		await triggerNextTask(
			batchId,
			remainingTaskIds,
			selectionMap,
			canvasId,
			apiKey,
		);
		return;
	}

	// Skip tasks already marked as FAILED (e.g., by propagateFailure from upstream node)
	if (existingTask?.status === TaskStatus.FAILED) {
		logger.info(
			`Task ${taskId} already failed (upstream propagation). Skipping execution.`,
		);
		await triggerNextTask(
			batchId,
			remainingTaskIds,
			selectionMap,
			canvasId,
			apiKey,
		);
		return;
	}

	// 1. Update Task Status to EXECUTING
	await prisma.task.update({
		where: { id: taskId },
		data: {
			status: TaskStatus.EXECUTING,
			startedAt,
		},
	});

	// Fetch task and node details early for use in catch if needed
	const task = await prisma.task.findUniqueOrThrow({
		where: { id: taskId },
	});

	if (!task.nodeId) throw new Error(`Task ${taskId} has no associated nodeId`);

	const currentNode = await prisma.node.findUniqueOrThrow({
		where: { id: task.nodeId },
		select: { id: true, type: true, name: true },
	});

	try {
		// 2. Fetch fresh Context Data
		const data = await GetCanvasEntities(canvasId);

		// 3. Validate Node Exists in data
		const node = data.nodes.find((n) => n.id === task.nodeId);
		if (!node) throw new Error("Node not found in canvas entities");

		const template = await prisma.nodeTemplate.findUniqueOrThrow({
			where: { type: currentNode.type },
		});

		// 4. Check Terminal Node Logic
		const isTerminal = template.isTerminalNode;
		if (isTerminal && !isExplicitlySelected) {
			logger.info(`Skipping processing for terminal node: ${node.id}`);
			await completeTask(taskId, startedAt, true);
			await checkAndFinishBatch(batchId);
			await triggerNextTask(
				batchId,
				remainingTaskIds,
				selectionMap,
				canvasId,
				apiKey,
			);
			return;
		}

		const batchTasks = await prisma.task.findMany({
			where: { batchId },
		});

		// 5. Execute Processor
		const ProcessorClass = nodeRegistry.getProcessor(
			node.type,
		) as NodeProcessorConstructor;

		if (!ProcessorClass) {
			logger.error(`No processor for node type ${node.type}`);
			throw new Error(`No processor for node type ${node.type}`);
		}

		logger.info(`Processing node: ${node.id} with type: ${node.type}`);

		const ctx: BackendNodeProcessorCtx = {
			node,
			data: { ...data, tasks: batchTasks, task, apiKey },
		};

		// Resolve from DI container
		const processorInstance = container.resolve(
			ProcessorClass,
		) as unknown as NodeProcessor;
		const result = await processorInstance.process(ctx);

		const { success, error, newResult } = result;

		// 6. Handle Results
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

		// 7. Finalize Task
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
			await checkAndFinishBatch(batchId);
			await triggerNextTask(
				batchId,
				remainingTaskIds,
				selectionMap,
				canvasId,
				apiKey,
			);
		} else {
			await propagateFailure(
				taskId,
				batchId,
				currentNode.name ?? currentNode.id,
				error ?? "Unknown error",
			);
			await checkAndFinishBatch(batchId);
			// Continue processing remaining tasks - propagateFailure already marked
			// graph-dependent downstream tasks as FAILED, but independent parallel
			// branches should still execute
			await triggerNextTask(
				batchId,
				remainingTaskIds,
				selectionMap,
				canvasId,
				apiKey,
			);
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

		await propagateFailure(
			taskId,
			batchId,
			currentNode.name ?? currentNode.id,
			errorMessage,
		);
		await checkAndFinishBatch(batchId);
		// Continue processing remaining tasks even on exception
		await triggerNextTask(
			batchId,
			remainingTaskIds,
			selectionMap,
			canvasId,
			apiKey,
		);
		throw err;
	}
};

async function triggerNextTask(
	batchId: string,
	remainingTaskIds: string[],
	selectionMap: Record<string, boolean>,
	canvasId: string,
	apiKey?: string,
) {
	if (remainingTaskIds.length === 0) {
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
		apiKey,
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
 * Recovers Zombie tasks that were left in EXECUTING state
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
			node: {
				select: { name: true },
			},
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

			const finishedAt = new Date();
			const durationMs = task.startedAt
				? finishedAt.getTime() - task.startedAt.getTime()
				: 0;
			const errorMsg = "Task abandoned due to system restart/crash.";

			await prisma.task.update({
				where: { id: task.id },
				data: {
					status: TaskStatus.FAILED,
					finishedAt,
					durationMs,
					error: { message: errorMsg },
				},
			});

			await propagateFailure(
				task.id,
				task.batchId,
				task.node?.name ?? task.id,
				errorMsg,
			);
			await checkAndFinishBatch(task.batchId);
		}
	}

	logger.info(
		`Recovery check complete. Cleaned up ${danglingTasks.length} tasks.`,
	);
}

const FIVE_MINS = 300_000;

const WORKER_LOCK_DURATION = FIVE_MINS;

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
		concurrency: ENV_CONFIG.MAX_CONCURRENT_WORKFLOW_JOBS,
		lockDuration: WORKER_LOCK_DURATION,
	});

	worker.on("failed", async (job, err) => {
		logger.error(`${job?.id} failed permanently: ${err.message}`);
		if (job?.data) {
			const { taskId, batchId } = job.data;

			try {
				const currentTask = await prisma.task.findFirstOrThrow({
					where: { id: taskId },
					select: { status: true, startedAt: true, nodeId: true },
				});

				if (currentTask?.status !== TaskStatus.FAILED) {
					const finishedAt = new Date();
					const durationMs = currentTask.startedAt
						? finishedAt.getTime() - currentTask.startedAt.getTime()
						: 0;
					const errorMsg = `Job failed/stalled: ${err.message}`;

					await prisma.task.update({
						where: { id: taskId },
						data: {
							status: TaskStatus.FAILED,
							finishedAt,
							durationMs,
							error: { message: errorMsg },
						},
					});

					const node = await prisma.node.findUnique({
						where: { id: currentTask.nodeId ?? "" },
						select: { name: true },
					});

					const nodeIdentifier = node?.name ?? taskId;

					await propagateFailure(taskId, batchId, nodeIdentifier, errorMsg);
				}

				await checkAndFinishBatch(batchId);
			} catch (dbErr) {
				assertIsError(dbErr);
				logger.error(
					`Failed to sync DB state on worker job failure: ${dbErr.message}`,
				);
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
