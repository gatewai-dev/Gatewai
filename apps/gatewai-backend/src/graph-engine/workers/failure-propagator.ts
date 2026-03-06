import { prisma, TaskStatus } from "@gatewai/db";

export async function propagateFailure(
	taskId: string,
	batchId: string,
	failedNodeIdentifier: string,
	errorMessage: string,
) {
	// Collect all transitively-reachable downstream task IDs first.
	const failedTaskIds = new Set<string>();

	async function collectDownstream(currentTaskId: string) {
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
		if (downstreamNodeIds.length === 0) return;

		const downstreamTasks = await prisma.task.findMany({
			where: {
				nodeId: { in: downstreamNodeIds },
				batchId,
				status: { in: [TaskStatus.QUEUED, TaskStatus.EXECUTING] },
			},
			select: { id: true },
		});

		for (const dt of downstreamTasks) {
			if (!failedTaskIds.has(dt.id)) {
				failedTaskIds.add(dt.id);
				await collectDownstream(dt.id);
			}
		}
	}

	await collectDownstream(taskId);

	if (failedTaskIds.size === 0) return;

	const idsToUpdate = Array.from(failedTaskIds);

	// Single bulk write for all downstream tasks.
	const finishedAt = new Date();
	await prisma.task.updateMany({
		where: {
			id: { in: idsToUpdate },
			// Only touch tasks that haven't already reached a terminal state.
			status: { in: [TaskStatus.QUEUED, TaskStatus.EXECUTING] },
		},
		data: {
			status: TaskStatus.FAILED,
			finishedAt,
			error: {
				message: `Upstream failure in node ${failedNodeIdentifier}: ${errorMessage}`,
			},
		},
	});
	// NOTE: Token refunds for failed/skipped tasks are handled by
	// reconcileBatchTokens() when the batch finishes.
}
