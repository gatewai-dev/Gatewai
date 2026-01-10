import { Prisma, prisma, TaskStatus } from "@gatewai/db";
import { type Job, Worker } from "bullmq";
import { logger } from "../../logger.js"; // Adjust path as needed
import { GetCanvasEntities } from "../../repositories/canvas.js"; // Adjust path as needed
import { nodeProcessors } from "../processors/index.js";
import { redisConnection } from "./connection.js";
import {
	type NodeTaskJobData,
	WORKFLOW_QUEUE_NAME,
	workflowQueue,
} from "./workflow.queue.js";

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

	// 1. Update Task Status to EXECUTING
	await prisma.task.update({
		where: { id: taskId },
		data: {
			status: TaskStatus.EXECUTING,
			startedAt,
		},
	});

	try {
		// 2. Fetch fresh Context Data (Crucial for getting results of previous nodes)
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

		if (!currentNode) {
			throw new Error("Node removed before processing");
		}

		const node = data.nodes.find((n) => n.id === task.nodeId);
		if (!node) throw new Error("Node not found in canvas entities");

		const template = await prisma.nodeTemplate.findUniqueOrThrow({
			where: { type: currentNode.type },
		});

		// 5. Check Terminal Node Logic
		const isTerminal = template.isTerminalNode;
		if (isTerminal && !isExplicitlySelected) {
			logger.info(
				`Skipping processing for terminal node: ${node.id} as it was not explicitly selected`,
			);
			await completeTask(taskId, startedAt, true);
			await triggerNextTask(batchId, remainingTaskIds, selectionMap, canvasId);
			return;
		}

		// 6. Execute Processor
		const processor = nodeProcessors[node.type];
		if (!processor) throw new Error(`No processor for node type ${node.type}`);

		logger.info(`Processing node: ${node.id} with type: ${node.type}`);

		const { success, error, newResult } = await processor({
			node,
			data,
			prisma,
		});

		if (error) logger.error(`${node.id}: Error: ${error}`);

		// 7. Handle Results
		if (newResult) {
			// Save to Task.result
			await prisma.task.update({
				where: { id: taskId },
				data: { result: newResult as unknown as Prisma.InputJsonValue },
			});

			// Save to Node.result (if not transient)
			if (success && !template.isTransient) {
				try {
					await prisma.node.update({
						where: { id: node.id },
						data: { result: newResult as unknown as Prisma.InputJsonValue },
					});
				} catch (updateErr) {
					if (
						updateErr instanceof Prisma.PrismaClientKnownRequestError &&
						updateErr.code === "P2025"
					) {
						logger.warn(
							`Node ${node.id} removed during processing, skipping result update`,
						);
					} else {
						throw updateErr;
					}
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
			// Fail the batch if a task fails
			await prisma.taskBatch.update({
				where: { id: batchId },
				data: { finishedAt: new Date() }, // Marking finished essentially "stops" the batch
			});
		}
	} catch (err: unknown) {
		logger.error({ err }, "Task execution failed");
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

		// Mark batch as finished (failed state implied by incomplete tasks)
		await prisma.taskBatch.update({
			where: { id: batchId },
			data: { finishedAt: new Date() },
		});

		throw err; // Re-throw to let BullMQ handle retry logic if needed
	}
};

// Helper: Trigger the next task in the sequence
async function triggerNextTask(
	batchId: string,
	remainingTaskIds: string[],
	selectionMap: Record<string, boolean>,
	canvasId: string,
) {
	if (remainingTaskIds.length === 0) {
		// Batch Complete
		await prisma.taskBatch.update({
			where: { id: batchId },
			data: { finishedAt: new Date() },
		});
		return;
	}

	const [nextTaskId, ...rest] = remainingTaskIds;
	const isSelected = selectionMap[nextTaskId] ?? false;

	await workflowQueue.add("process-node", {
		taskId: nextTaskId,
		canvasId,
		batchId,
		remainingTaskIds: rest,
		isExplicitlySelected: isSelected,
		selectionMap,
	});
}

// Helper: Fast complete for skipped nodes
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

export const startWorker = () => {
	// Initialize Worker
	const worker = new Worker<NodeTaskJobData>(
		WORKFLOW_QUEUE_NAME,
		processNodeJob,
		{
			connection: redisConnection,
			concurrency: 5, // Can process 5 disjoint batches in parallel
		},
	);

	worker.on("completed", (job) => console.log(`${job.id} has completed!`));
	worker.on("failed", (job, err) =>
		console.error(`${job?.id} failed: ${err.message}`),
	);
};
