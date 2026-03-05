import { ENV_CONFIG, type IPricingService, logger } from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import { Prisma, prisma, TaskStatus } from "@gatewai/db";
import { type NodeTaskJobData, workflowQueue } from "@gatewai/graph-engine";
import { assertIsError } from "../../utils/misc.js";

export async function checkAndFinishBatch(batchId: string) {
	try {
		const pendingCount = await prisma.task.count({
			where: {
				batchId,
				status: { in: [TaskStatus.QUEUED, TaskStatus.EXECUTING] },
			},
		});

		if (pendingCount !== 0) return;

		// Atomic guard: only the first caller that sets finishedAt will proceed.
		const updated = await prisma.taskBatch.updateMany({
			where: { id: batchId, finishedAt: null },
			data: { finishedAt: new Date() },
		});

		if (updated.count > 0) {
			// ── Reconcile tokens: refund for tasks that didn't succeed ──
			await reconcileBatchTokens(batchId);

			const batch = await prisma.taskBatch.findUnique({
				where: { id: batchId },
				select: { canvasId: true },
			});
			if (batch) {
				await dispatchNextPendingBatch(batch.canvasId);
			}
		}
	} catch (e) {
		assertIsError(e);
		logger.warn(`Could not check and finish batch ${batchId}: ${e.message}`);
	}
}

/**
 * Single reconciliation point: refund tokens for tasks that were charged
 * upfront but did not complete successfully.
 */
export async function reconcileBatchTokens(batchId: string) {
	if (!ENV_CONFIG.ENABLE_PRICING) return;

	try {
		const batch = await prisma.taskBatch.findUnique({
			where: { id: batchId },
			select: { canvasId: true },
		});
		if (!batch) return;

		const canvas = await prisma.canvas.findUnique({
			where: { id: batch.canvasId },
			select: { userId: true },
		});
		if (!canvas?.userId) return;

		const tasks = await prisma.task.findMany({
			where: { batchId },
			select: { price: true, status: true },
		});

		const totalCharged = tasks.reduce((sum, t) => sum + (t.price ?? 0), 0);
		const successCost = tasks
			.filter((t) => t.status === TaskStatus.COMPLETED)
			.reduce((sum, t) => sum + (t.price ?? 0), 0);
		const refundAmount = totalCharged - successCost;

		if (refundAmount > 0) {
			const pricingService = container.get<IPricingService>(
				TOKENS.PRICING_SERVICE,
			);
			await pricingService.creditTokens(canvas.userId, refundAmount, "REFUND", {
				batchId,
				reason: "Batch reconciliation",
			});
			logger.info(
				`Reconciled batch ${batchId}: refunded ${refundAmount} tokens (charged ${totalCharged}, success ${successCost})`,
			);
		}
	} catch (e) {
		assertIsError(e);
		logger.error(
			`Failed to reconcile tokens for batch ${batchId}: ${e.message}`,
		);
	}
}

export async function dispatchNextPendingBatch(canvasId: string) {
	try {
		const nextBatch = await prisma.taskBatch.findFirst({
			where: {
				canvasId,
				pendingJobData: { not: Prisma.JsonNull },
				startedAt: null,
			},
			orderBy: { createdAt: "asc" },
		});

		if (!nextBatch?.pendingJobData) return;

		const jobData = nextBatch.pendingJobData as unknown as NodeTaskJobData;

		// Enqueue first — if this throws, the DB record stays intact and can be
		// retried on the next batch-completion cycle.
		await workflowQueue.add("process-node", jobData, {
			jobId: jobData.taskId,
		});

		// Only clear pendingJobData once we know the job was accepted by the queue.
		await prisma.taskBatch.update({
			where: { id: nextBatch.id },
			data: {
				startedAt: new Date(),
				pendingJobData: Prisma.DbNull,
			},
		});

		logger.info(
			`Dispatched pending batch ${nextBatch.id} for canvas ${canvasId}`,
		);
	} catch (e) {
		assertIsError(e);
		logger.error(
			`Failed to dispatch next pending batch for canvas ${canvasId}: ${e.message}`,
		);
	}
}
