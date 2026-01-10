// src/workers/node-worker.ts

import { PrismaClient, TaskStatus } from "@gatewai/db";
import type { NodeResult } from "@gatewai/types";
import { Job, Worker } from "bullmq";
import { logger } from "../logger.js";
import { NodeWFProcessor } from "../node-wf-processor.js"; // Adjust path as needed
import { redisConnection } from "../redis.js";
import { GetCanvasEntities } from "../repositories/canvas.js";

const prisma = new PrismaClient();
const processor = new NodeWFProcessor(prisma);

const worker = new Worker(
	"node-processing",
	async (job: Job) => {
		if (job.name !== "process-node-task") {
			logger.warn(`Unknown job name: ${job.name}`);
			return;
		}

		const { taskId, canvasId, isExplicitlySelected } = job.data;

		// Fetch task to get batchId
		const task = await prisma.task.findUniqueOrThrow({
			where: { id: taskId },
			include: { batch: true },
		});
		const batchId = task.batchId;

		// Load canvas data
		const data = await GetCanvasEntities(canvasId);

		// Overlay results from completed tasks in this batch
		const completedTasks = await prisma.task.findMany({
			where: {
				batchId,
				status: TaskStatus.COMPLETED,
			},
			select: {
				id: true,
				nodeId: true,
				result: true,
			},
		});

		for (const ct of completedTasks) {
			const node = data.nodes.find((n) => n.id === ct.nodeId);
			if (node) {
				node.result = ct.result as unknown as NodeResult;
			}
		}

		try {
			await processor.processTask(taskId, data, isExplicitlySelected);
		} catch (err) {
			logger.error(`Error processing task ${taskId}: ${err}`);
			// Error is already handled in processTask by setting FAILED status
		} finally {
			// Decrement batch remaining count
			const batchKey = `batch-remaining:${batchId}`;
			const batchRemaining = await redisConnection.decr(batchKey);
			if (batchRemaining <= 0) {
				const finishedAt = new Date();
				await prisma.taskBatch.update({
					where: { id: batchId },
					data: { finishedAt },
				});
				await redisConnection.del(batchKey);
			}

			// Trigger downstream nodes
			const downstreamTaskIds: string[] = job.data.downstreamTaskIds || [];
			for (const dsId of downstreamTaskIds) {
				const depKey = `remaining-deps:${dsId}`;
				const remaining = await redisConnection.decr(depKey);
				if (remaining <= 0) {
					const dsJob = await Job.fromId(job.queue, dsId);
					if (dsJob) {
						await dsJob.changeDelay(0);
					}
					await redisConnection.del(depKey);
				}
			}
		}
	},
	{
		connection: redisConnection,
		concurrency: 10, // Adjust based on expected load; allows parallel processing of independent nodes
		limiter: {
			max: 100,
			duration: 1000,
		}, // Rate limiting to prevent overload
	},
);

// Graceful shutdown
process.on("SIGTERM", async () => {
	await worker.close();
	await prisma.$disconnect();
});
