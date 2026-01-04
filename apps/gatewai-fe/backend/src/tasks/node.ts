import {
	type Canvas,
	type Node,
	Prisma,
	type PrismaClient,
	type Task,
	type TaskBatch,
	TaskStatus,
} from "@gatewai/db";
import type { NodeResult } from "@gatewai/types";
import type { User } from "better-auth";
import {
	type CanvasCtxData,
	GetCanvasEntities,
} from "../repositories/canvas.js";
import { nodeProcessors } from "./processors/index.js";

/**
 * Workflow processor for canvas
 * Refactored to support async, generation-based parallel processing
 * similar to the frontend NodeGraphProcessor.
 */
export class NodeWFProcessor {
	private prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	/**
	 * Builds dependency maps for a specific set of nodes.
	 */
	private buildDepGraphs(
		nodeIds: Node["id"][],
		data: CanvasCtxData,
	): {
		depGraph: Map<Node["id"], Node["id"][]>; // nodeId -> downstream (children)
		revDepGraph: Map<Node["id"], Node["id"][]>; // nodeId -> upstream (parents)
	} {
		const selectedSet = new Set(nodeIds);
		const depGraph = new Map<Node["id"], Node["id"][]>();
		const revDepGraph = new Map<Node["id"], Node["id"][]>();

		nodeIds.forEach((id) => {
			depGraph.set(id, []);
			revDepGraph.set(id, []);
		});

		for (const edge of data.edges) {
			if (selectedSet.has(edge.source) && selectedSet.has(edge.target)) {
				const sourceDep = depGraph.get(edge.source);
				if (sourceDep) sourceDep.push(edge.target);

				const revTargetDep = revDepGraph.get(edge.target);
				if (revTargetDep) revTargetDep.push(edge.source);
			}
		}

		return { depGraph, revDepGraph };
	}

	public async processNodes(
		canvasId: Canvas["id"],
		user: User,
		/**
		 * Node ID's to run - It'll run all of them in canvas if not provided
		 */
		nodeIds?: Node["id"][],
	): Promise<TaskBatch> {
		// 1. Fetch Context
		const data = await GetCanvasEntities(canvasId);
		const allNodeIds = data.nodes.map((n) => n.id);

		// 2. Determine Subgraph (Target nodes + Ancestors)
		const { revDepGraph: fullRevDepGraph } = this.buildDepGraphs(
			allNodeIds,
			data,
		);

		const targets = nodeIds ?? allNodeIds;
		const necessary = new Set<Node["id"]>();
		const queue: Node["id"][] = [...targets];

		// BFS to find all upstream dependencies
		while (queue.length > 0) {
			const curr = queue.shift();
			if (!curr) break;
			if (necessary.has(curr)) continue;
			necessary.add(curr);
			const ups = fullRevDepGraph.get(curr) || [];
			queue.push(...ups);
		}

		const necessaryIds = Array.from(necessary);

		// 3. Create Batch & Tasks (Upfront for visibility)
		let batch = await this.prisma.taskBatch.create({
			data: {
				userId: user.id,
				canvasId,
			},
		});

		// Verify all necessary nodes exist in data
		const tasksMap = new Map<
			Node["id"],
			{ id: Task["id"]; nodeId: Node["id"] }
		>();

		// We create tasks for all necessary nodes
		for (const nodeId of necessaryIds) {
			const node = data.nodes.find((n) => n.id === nodeId);
			if (!node) {
				// Should technically not happen if graph integrity is maintained
				throw new Error(`Node ${nodeId} missing in canvas data`);
			}
			const task = await this.prisma.task.create({
				data: {
					name: `Process node ${node.name || node.id}`,
					nodeId,
					status: TaskStatus.QUEUED,
					isTest: false,
					batchId: batch.id,
				},
			});
			tasksMap.set(nodeId, { id: task.id, nodeId });
		}

		// Refetch batch to include tasks relation
		batch = await this.prisma.taskBatch.findUniqueOrThrow({
			where: { id: batch.id },
			include: {
				tasks: {
					include: {
						node: true,
					},
				},
			},
		});

		// 4. Build Execution Graph for the Necessary Subgraph
		const { revDepGraph } = this.buildDepGraphs(necessaryIds, data);

		// 5. Execute Async Loop (Fire & Forget from caller's perspective, or await if needed)
		// We wrap this in an async function to allow `processNodes` to return the batch immediately
		// if we wanted to (though the original code awaited execution, so we will await here).
		const executeGraph = async () => {
			const taskStatusMap = new Map<Node["id"], TaskStatus>();
			necessaryIds.forEach((id) => taskStatusMap.set(id, TaskStatus.QUEUED));

			while (true) {
				// Find nodes that are still queued
				const pending = necessaryIds.filter(
					(id) => taskStatusMap.get(id) === TaskStatus.QUEUED,
				);

				if (pending.length === 0) {
					break; // All done
				}

				const ready: string[] = [];
				const skipped: string[] = [];

				for (const id of pending) {
					const parents = revDepGraph.get(id) || [];
					const parentStatuses = parents.map((p) => taskStatusMap.get(p));

					// If any parent failed, this node cannot run
					if (parentStatuses.some((s) => s === TaskStatus.FAILED)) {
						skipped.push(id);
					}
					// If all parents are completed, this node is ready
					else if (parentStatuses.every((s) => s === TaskStatus.COMPLETED)) {
						ready.push(id);
					}
					// Otherwise, parents are still QUEUED or EXECUTING, so we wait
				}

				// Deadlock / Cycle Detection
				if (ready.length === 0 && skipped.length === 0) {
					// No nodes are ready, but there are pending nodes.
					// This implies a cycle or a state inconsistency.
					// Fail all remaining pending nodes.
					await Promise.all(
						pending.map((id) =>
							this.failTask(
								tasksMap.get(id)!.id,
								"Dependency cycle or deadlock detected",
								taskStatusMap,
								id,
							),
						),
					);
					break;
				}

				// Process Skipped (Upstream Failure)
				if (skipped.length > 0) {
					await Promise.all(
						skipped.map((id) =>
							this.failTask(
								tasksMap.get(id)!.id,
								"Upstream dependency failed",
								taskStatusMap,
								id,
							),
						),
					);
				}

				// Process Ready (Parallel Execution)
				if (ready.length > 0) {
					// Mark as executing locally before await to prevent re-selection in tight loops
					// (Though currently we await Promise.all, so it's strictly generational)
					ready.forEach((id) => taskStatusMap.set(id, TaskStatus.EXECUTING));

					await Promise.all(
						ready.map((id) =>
							this.executeNode(id, data, tasksMap, taskStatusMap),
						),
					);
				}
			}

			// Finish Batch
			await this.prisma.taskBatch.update({
				where: { id: batch.id },
				data: { finishedAt: new Date() },
			});
		};

		// Run execution
		await executeGraph();

		return batch;
	}

	/**
	 * Executes a single node and updates its state and the shared data context.
	 */
	private async executeNode(
		nodeId: string,
		data: CanvasCtxData,
		tasksMap: Map<string, { id: string; nodeId: string }>,
		taskStatusMap: Map<string, TaskStatus>,
	) {
		const task = tasksMap.get(nodeId);
		if (!task) return;

		const startedAt = new Date();
		await this.prisma.task.update({
			where: { id: task.id },
			data: { status: TaskStatus.EXECUTING, startedAt },
		});

		try {
			// 1. Validation
			const node = data.nodes.find((n) => n.id === nodeId);
			if (!node) {
				throw new Error("Node not found in context");
			}

			// DB Verification (ensure node wasn't deleted mid-process)
			const dbNode = await this.prisma.node.findUnique({
				where: { id: nodeId },
				select: { id: true, type: true },
			});

			if (!dbNode) {
				throw new Error("Node removed before processing");
			}

			const template = await this.prisma.nodeTemplate.findUnique({
				where: { type: dbNode.type },
			});

			const processor = nodeProcessors[node.type];
			if (!processor) {
				throw new Error(`No processor for node type ${node.type}.`);
			}

			// 2. Execution
			// Note: `data` is passed by reference. Processors read upstream results from `data.nodes`.
			const { success, error, newResult } = await processor({
				node,
				data,
				prisma: this.prisma,
			});

			if (!success) {
				throw new Error(error || "Unknown processor error");
			}

			// 3. Update Shared Context (Memory)
			// This is crucial for downstream nodes to see the result
			if (newResult) {
				const nodeRef = data.nodes.find((n) => n.id === nodeId);
				if (nodeRef) {
					nodeRef.result = structuredClone(newResult) as unknown as NodeResult;
				}
			}

			// 4. Persist Result (DB)
			if (!template?.isTransient && newResult) {
				try {
					await this.prisma.node.update({
						where: { id: nodeId },
						data: { result: newResult as NodeResult },
					});
				} catch (err) {
					// Ignore P2025 (Record not found) in case of race condition deletion
					if (
						!(
							err instanceof Prisma.PrismaClientKnownRequestError &&
							err.code === "P2025"
						)
					) {
						throw err;
					}
				}
			}

			// 5. Complete Task
			const finishedAt = new Date();
			await this.prisma.task.update({
				where: { id: task.id },
				data: {
					status: TaskStatus.COMPLETED,
					finishedAt,
					durationMs: finishedAt.getTime() - startedAt.getTime(),
				},
			});

			taskStatusMap.set(nodeId, TaskStatus.COMPLETED);
		} catch (err: unknown) {
			const finishedAt = new Date();
			const message =
				err instanceof Error ? err.message : "Unknown execution error";

			await this.prisma.task.update({
				where: { id: task.id },
				data: {
					status: TaskStatus.FAILED,
					finishedAt,
					durationMs: finishedAt.getTime() - startedAt.getTime(),
					error: { message },
				},
			});

			taskStatusMap.set(nodeId, TaskStatus.FAILED);
		}
	}

	/**
	 * Helper to mark a task as failed without running it
	 */
	private async failTask(
		taskId: string,
		reason: string,
		taskStatusMap: Map<string, TaskStatus>,
		nodeId: string,
	) {
		const now = new Date();
		await this.prisma.task.update({
			where: { id: taskId },
			data: {
				status: TaskStatus.FAILED,
				startedAt: now,
				finishedAt: now,
				durationMs: 0,
				error: { message: reason },
			},
		});
		taskStatusMap.set(nodeId, TaskStatus.FAILED);
	}
}
