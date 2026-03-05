import { logger } from "@gatewai/core";
import { prisma, TaskStatus } from "@gatewai/db";
import { assertIsError } from "../../utils/misc.js";
import { checkAndFinishBatch } from "./batch-manager.js";
import { propagateFailure } from "./failure-propagator.js";

export async function recoverDanglingTasks() {
	logger.info("Starting startup recovery check...");

	const danglingTasks = await prisma.task.findMany({
		where: { status: TaskStatus.EXECUTING },
		include: {
			batch: true,
			node: { select: { name: true } },
		},
	});

	if (danglingTasks.length === 0) {
		logger.info("No dangling tasks found.");
		return;
	}

	logger.warn(
		`Found ${danglingTasks.length} dangling EXECUTING task(s). Recovering...`,
	);

	let cleanedCount = 0;

	for (const task of danglingTasks) {
		try {
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

			// Refund handled by reconcileBatchTokens at batch completion

			await propagateFailure(
				task.id,
				task.batchId,
				task.node?.name ?? task.id,
				errorMsg,
			);
			await checkAndFinishBatch(task.batchId);
			cleanedCount++;
		} catch (e) {
			assertIsError(e);
			logger.error(`Failed to recover task ${task.id}: ${e.message}`);
		}
	}

	// FIX #4: report actual cleaned count, not total found.
	logger.info(
		`Recovery check complete. Cleaned up ${cleanedCount} of ${danglingTasks.length} dangling task(s).`,
	);
}
