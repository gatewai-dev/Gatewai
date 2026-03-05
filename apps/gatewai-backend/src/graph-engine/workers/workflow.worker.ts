import {
	ENV_CONFIG,
	type IPricingService,
	logger,
	loggerContext,
} from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import { GetCanvasEntities } from "@gatewai/data-ops";
import { type Prisma, prisma, TaskStatus } from "@gatewai/db";
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

import { checkAndFinishBatch } from "./batch-manager.js";
import { propagateFailure } from "./failure-propagator.js";
import { recoverDanglingTasks } from "./task-recovery.js";

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
		apiKey,
	} = job.data;

	const startedAt = new Date();

	const existingTask = await prisma.task.findUnique({
		where: { id: taskId },
		select: { status: true },
	});

	if (existingTask?.status === TaskStatus.COMPLETED) {
		logger.info(`Task ${taskId} already completed. Skipping execution.`);
		await triggerNextTask(
			batchId,
			remainingTaskIds,
			selectionMap,
			canvasId,
			apiKey,
		);
		return;
	}

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

	if (existingTask?.status === TaskStatus.CANCELLED) {
		logger.info(`Task ${taskId} already cancelled. Skipping execution.`);
		return;
	}

	await prisma.task.update({
		where: { id: taskId },
		data: { status: TaskStatus.EXECUTING, startedAt },
	});

	const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
	if (!task.nodeId) throw new Error(`Task ${taskId} has no associated nodeId`);

	const currentNode = await prisma.node.findUniqueOrThrow({
		where: { id: task.nodeId },
		select: { id: true, type: true, name: true },
	});

	// Re-evaluate price from task record (best)
	const taskPrice = task.price ?? 0;
	const pricingEnabled = ENV_CONFIG.ENABLE_PRICING;

	let resolvedUserId: string | undefined;
	const pricingService = container.get<IPricingService>(TOKENS.PRICING_SERVICE);

	if (pricingEnabled) {
		if (apiKey) {
			const keyRecord = await prisma.apiKey.findUnique({
				where: { key: apiKey },
				select: { userId: true },
			});
			resolvedUserId = keyRecord?.userId;
		} else {
			const canvas = await prisma.canvas.findUnique({
				where: { id: canvasId },
				select: { userId: true },
			});
			resolvedUserId = canvas?.userId ?? undefined;
		}
	}

	await loggerContext.run(
		{
			canvasId,
			taskId,
			batchId,
			nodeType: currentNode.type,
			nodeName: currentNode.name,
		},
		async () => {
			try {
				const data = await GetCanvasEntities(canvasId);

				const node = data.nodes.find((n) => n.id === task.nodeId);
				if (!node) throw new Error("Node not found in canvas entities");

				const template = await prisma.nodeTemplate.findUniqueOrThrow({
					where: { type: currentNode.type },
				});

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

				const ProcessorClass = nodeRegistry.getProcessor(
					node.type,
				) as NodeProcessorConstructor;

				if (!ProcessorClass) {
					logger.error(`No processor for node type ${node.type}`);
					throw new Error(`No processor for node type ${node.type}`);
				}

				logger.info(`Processing node: ${node.id} with type: ${node.type}`);

				if (!container.isBound(ProcessorClass)) {
					container.bind(ProcessorClass).toSelf().inTransientScope();
				}
				const processorInstance = container.get(
					ProcessorClass,
				) as unknown as NodeProcessor;

				const ctx: BackendNodeProcessorCtx = {
					node,
					data: { ...data, tasks: batchTasks, task, apiKey },
				};

				const result = await processorInstance.process(ctx);
				const { success, error, newResult } = result;

				if (newResult) {
					await prisma.task.update({
						where: { id: taskId },
						data: { result: newResult as unknown as Prisma.InputJsonValue },
					});

					if (success && !template.isTransient) {
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

				if (success) {
					// Track usage on success
					if (resolvedUserId && taskPrice > 0) {
						await pricingService.trackUsage(
							resolvedUserId,
							"tokensUsed",
							taskPrice,
						);
						await pricingService.trackUsage(resolvedUserId, "tasksUsed", 1);
					}
				}

				const finishedAt = new Date();
				await prisma.task.update({
					where: { id: taskId },
					data: {
						status: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
						finishedAt,
						durationMs: finishedAt.getTime() - startedAt.getTime(),
						error: error ? { message: error } : undefined,
						price: taskPrice,
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
					// Refund handled by reconcileBatchTokens at batch completion
					await propagateFailure(
						taskId,
						batchId,
						currentNode.name ?? currentNode.id,
						error ?? "Unknown error",
					);
					await checkAndFinishBatch(batchId);
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
				const errorMessage =
					err instanceof Error ? err.message : "Unknown error";

				// Refund handled by reconcileBatchTokens at batch completion

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
				await triggerNextTask(
					batchId,
					remainingTaskIds,
					selectionMap,
					canvasId,
					apiKey,
				);
			}
		},
	);
};

export async function triggerNextTask(
	batchId: string,
	remainingTaskIds: string[],
	selectionMap: Record<string, boolean>,
	canvasId: string,
	apiKey?: string,
) {
	if (remainingTaskIds.length === 0) return;

	// Check if batch is already finished/stopped
	const batch = await prisma.taskBatch.findUnique({
		where: { id: batchId },
		select: { finishedAt: true },
	});

	if (batch?.finishedAt) {
		logger.info(
			`Batch ${batchId} is already finished. Skipping triggerNextTask.`,
		);
		return;
	}

	// Fetch the current statuses of all remaining tasks in one query.
	const taskStatuses = await prisma.task.findMany({
		where: { id: { in: remainingTaskIds } },
		select: { id: true, status: true },
	});

	const terminalIds = new Set(
		taskStatuses
			.filter(
				(t) =>
					(t.status && t.status === TaskStatus.COMPLETED) ||
					t.status === TaskStatus.FAILED,
			)
			.map((t) => t.id),
	);

	// Find the first non-terminal task to dispatch.
	const nextTaskId = remainingTaskIds.find((id) => !terminalIds.has(id));
	if (!nextTaskId) return;

	const rest = remainingTaskIds.slice(remainingTaskIds.indexOf(nextTaskId) + 1);
	const isSelected = selectionMap[nextTaskId] ?? false;

	await workflowQueue.add(
		"process-node",
		{
			taskId: nextTaskId,
			canvasId,
			batchId,
			remainingTaskIds: rest,
			isExplicitlySelected: isSelected,
			selectionMap,
			apiKey,
		},
		{ jobId: nextTaskId },
	);
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

const FIVE_MINS = 300_000;
const WORKER_LOCK_DURATION = FIVE_MINS;

export const startWorkflowWorker = async () => {
	logger.info("Starting Workflow Worker...");

	try {
		await recoverDanglingTasks();
	} catch (err) {
		assertIsError(err);
		logger.error(`Failed to run startup recovery, ${err.message}`);
	}

	worker = new Worker<NodeTaskJobData>(WORKFLOW_QUEUE_NAME, processNodeJob, {
		connection: redisConnection,
		concurrency: ENV_CONFIG.MAX_CONCURRENT_WORKFLOW_JOBS,
		lockDuration: WORKER_LOCK_DURATION,
	});

	worker.on("stalled", async (jobId: string) => {
		logger.warn(`Job ${jobId} stalled — marking task as FAILED.`);
		try {
			const task = await prisma.task.findFirst({
				where: { id: jobId, status: TaskStatus.EXECUTING },
				include: { node: { select: { name: true } } },
			});

			if (!task) return;

			const finishedAt = new Date();
			const durationMs = task.startedAt
				? finishedAt.getTime() - task.startedAt.getTime()
				: 0;
			const errorMsg = "Task stalled (exceeded lock duration).";

			await prisma.task.update({
				where: { id: task.id },
				data: {
					status: TaskStatus.FAILED,
					finishedAt,
					durationMs,
					error: { message: errorMsg },
				},
			});

			// Refund handled by reconcileBatchTokens at batch completion

			await propagateFailure(
				task.id,
				task.batchId,
				task.node?.name ?? task.id,
				errorMsg,
			);
			await checkAndFinishBatch(task.batchId);
		} catch (e) {
			assertIsError(e);
			logger.error(`Failed to handle stalled job ${jobId}: ${e.message}`);
		}
	});

	worker.on("failed", async (job, err) => {
		logger.error(`${job?.id} failed permanently: ${err.message}`);
		if (!job?.data) return;

		const { taskId, batchId } = job.data;

		try {
			const currentTask = await prisma.task.findFirstOrThrow({
				where: { id: taskId },
				select: { status: true, startedAt: true, nodeId: true },
			});

			if (currentTask.status !== TaskStatus.FAILED) {
				const finishedAt = new Date();
				const durationMs = currentTask.startedAt
					? finishedAt.getTime() - currentTask.startedAt.getTime()
					: 0;
				const errorMsg = `Job failed/stalled: ${err.message}`;

				// Refund handled by reconcileBatchTokens at batch completion

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

				await propagateFailure(taskId, batchId, node?.name ?? taskId, errorMsg);
			}

			await checkAndFinishBatch(batchId);
		} catch (dbErr) {
			assertIsError(dbErr);
			logger.error(
				`Failed to sync DB state on worker job failure: ${dbErr.message}`,
			);
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
