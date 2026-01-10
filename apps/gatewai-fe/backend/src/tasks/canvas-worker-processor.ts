// src/node-wf-processor.ts
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
import { Job } from "bullmq";
import { logger } from "../logger.js";
import { nodeQueue } from "../queues/node-queue.js";
import { redisConnection } from "../redis.js";
import {
	type CanvasCtxData,
	GetCanvasEntities,
} from "../repositories/canvas.js";
import { nodeProcessors } from "./processors/index.js";

/**
 * Workflow processor for canvas
 */
export class NodeWFProcessor {
	public prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	// Build dependency graphs within selected nodes.
	public buildDepGraphs(
		nodeIds: Node["id"][],
		data: CanvasCtxData,
	): {
		depGraph: Map<Node["id"], Node["id"][]>; // nodeId -> downstream selected nodeIds
		revDepGraph: Map<Node["id"], Node["id"][]>; // nodeId -> upstream selected nodeIds
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
				if (sourceDep) {
					sourceDep.push(edge.target);
				}
				const revTargetDep = revDepGraph.get(edge.target);
				if (revTargetDep) {
					revTargetDep.push(edge.source);
				}
			}
		}

		return { depGraph, revDepGraph };
	}

	// Topo sort - Kahn algo. Used for cycle detection.
	public topologicalSort(
		nodes: string[],
		depGraph: Map<Node["id"], Node["id"][]>,
		revDepGraph: Map<Node["id"], Node["id"][]>,
	): string[] | null {
		const indegree = new Map(
			nodes.map((id) => {
				const deps = revDepGraph.get(id);
				if (!deps) {
					throw new Error(`Missing reverse dependencies for node ${id}`);
				}
				return [id, deps.length];
			}),
		);
		const queue = nodes.filter((id) => indegree.get(id) === 0);
		const order: Node["id"][] = [];

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) break;
			order.push(current);

			const downstream = depGraph.get(current) || [];
			for (const ds of downstream) {
				const currentDeg = indegree.get(ds);
				if (currentDeg === undefined) {
					throw new Error(`Missing indegree for node ${ds}`);
				}
				const deg = currentDeg - 1;
				indegree.set(ds, deg);
				if (deg === 0) {
					queue.push(ds);
				}
			}
		}

		if (order.length === nodes.length) {
			return order;
		}
		return null;
	}

	public async processTask(
		taskId: Task["id"],
		data: CanvasCtxData,
		isExplicitlySelected: boolean,
	): Promise<void> {
		const startedAt = new Date();
		await this.prisma.task.update({
			where: { id: taskId },
			data: {
				status: TaskStatus.EXECUTING,
				startedAt,
			},
		});

		// Fetch task to get nodeId
		const task = await this.prisma.task.findUniqueOrThrow({
			where: { id: taskId },
			select: { nodeId: true },
		});

		if (!task.nodeId) {
			throw new Error(`Task ${taskId} has no associated nodeId`);
		}

		// Defensive: Ensure node still exists in DB before processing
		const currentNode = await this.prisma.node.findUnique({
			where: { id: task.nodeId },
			select: { id: true, type: true, name: true },
		});

		if (!currentNode) {
			const now = new Date();
			await this.prisma.task.update({
				where: { id: taskId },
				data: {
					status: TaskStatus.FAILED,
					startedAt: now,
					finishedAt: now,
					durationMs: 0,
					error: { message: "Node removed before processing" },
					result: null,
				},
			});
			return;
		}

		const node = data.nodes.find((n) => n.id === task.nodeId);
		if (!node) {
			throw new Error("Node not found");
		}
		const template = await this.prisma.nodeTemplate.findUniqueOrThrow({
			where: { type: currentNode.type },
		});

		const isTerminal = template.isTerminalNode;
		if (isTerminal && !isExplicitlySelected) {
			logger.info(
				`Skipping processing for terminal node: ${node.id} (type: ${node.type}) as it was not explicitly selected`,
			);
			const finishedAt = new Date();
			await this.prisma.task.update({
				where: { id: taskId },
				data: {
					status: TaskStatus.COMPLETED,
					finishedAt,
					durationMs: finishedAt.getTime() - startedAt.getTime(),
					result: null,
				},
			});
			return;
		}

		const processor = nodeProcessors[node.type];
		if (!processor) {
			throw new Error(`No processor for node type ${node.type}.`);
		}

		let success = false;
		let error: string | undefined;
		let newResult: NodeResult | undefined;

		try {
			// Await processor, pass current data
			logger.info(`Processing node: ${node.id} with type: ${node.type}`);
			const result = await processor({
				node,
				data,
				prisma: this.prisma,
			});

			success = result.success;
			error = result.error;
			newResult = result.newResult;

			if (error) {
				logger.error(`${node.id}: Error: ${error}`);
			}

			if (newResult) {
				const updatedNode = data.nodes.find((n) => n.id === task.nodeId);
				if (!updatedNode) {
					throw new Error("Node not found to update");
				}
				updatedNode.result = structuredClone(
					newResult,
				) as unknown as NodeResult;
			}
		} catch (err: unknown) {
			logger.error({ err });
			success = false;
			error = err instanceof Error ? err.message : "Unknown error";
		} finally {
			const finishedAt = new Date();
			await this.prisma.task.update({
				where: { id: taskId },
				data: {
					status: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
					finishedAt,
					durationMs: finishedAt.getTime() - startedAt.getTime(),
					error: error ? { message: error } : undefined,
					result: newResult as Prisma.JsonValue | undefined,
				},
			});

			// Persist to DB only if not transient
			if (success && !template.isTransient && newResult) {
				try {
					await this.prisma.node.update({
						where: { id: node.id },
						data: { result: newResult as NodeResult },
					});
				} catch (updateErr) {
					if (
						updateErr instanceof Prisma.PrismaClientKnownRequestError &&
						updateErr.code === "P2025"
					) {
						logger.info(
							`Node ${node.id} removed during processing, skipping result update`,
						);
					} else {
						throw updateErr;
					}
				}
			}
		}
	}

	public async processNodes(
		canvasId: Canvas["id"],
		/**
		 * Node ID's to run - It'll run all of them in canvas if not provided
		 */
		nodeIds?: Node["id"][],
	): Promise<TaskBatch> {
		const data = await GetCanvasEntities(canvasId);

		let batch = await this.prisma.taskBatch.create({
			data: {
				canvasId,
			},
			include: {
				tasks: {
					include: {
						node: true,
					},
				},
			},
		});

		const allNodeIds = data.nodes.map((n) => n.id);
		const { revDepGraph: fullRevDepGraph } = this.buildDepGraphs(
			allNodeIds,
			data,
		);

		const nodeIdsToRun = nodeIds ?? allNodeIds;

		// Find all necessary nodes: selected + all upstream dependencies
		const necessary = new Set<Node["id"]>();
		const queue: Node["id"][] = [...nodeIdsToRun];
		while (queue.length > 0) {
			const curr = queue.shift();
			if (!curr) break;
			if (necessary.has(curr)) continue;
			necessary.add(curr);
			const ups = fullRevDepGraph.get(curr) || [];
			queue.push(...ups);
		}

		// Fetch templates to identify terminal nodes
		// This prevents upstream terminal nodes from being added to the task list
		// if they weren't explicitly selected by the user.
		const nodeTypesInCanvas = Array.from(
			new Set(data.nodes.map((n) => n.type)),
		);
		const templates = await this.prisma.nodeTemplate.findMany({
			where: { type: { in: nodeTypesInCanvas } },
			select: { type: true, isTerminalNode: true },
		});
		const terminalTypes = new Set(
			templates.filter((t) => t.isTerminalNode).map((t) => t.type),
		);

		// Filter out unselected terminal nodes from necessary set
		const filteredNecessary = new Set<Node["id"]>();
		for (const nodeId of necessary) {
			const node = data.nodes.find((n) => n.id === nodeId);
			if (!node) continue;

			const isExplicitlySelected = nodeIdsToRun.includes(nodeId);
			const isTerminal = terminalTypes.has(node.type);

			// Only keep the node if it's explicitly selected OR it's NOT a terminal node.
			// This stops "ghost" tasks for unselected terminal nodes that are upstream.
			if (isExplicitlySelected || !isTerminal) {
				filteredNecessary.add(nodeId);
			}
		}

		const necessaryIds = Array.from(filteredNecessary);

		// Build subgraph for necessary nodes
		const { depGraph, revDepGraph } = this.buildDepGraphs(necessaryIds, data);

		// Cycle detection
		const topoOrder = this.topologicalSort(necessaryIds, depGraph, revDepGraph);
		if (!topoOrder) {
			throw new Error("Cycle detected in necessary nodes.");
		}

		// Validate necessary nodes exist
		const necessaryNodes = data.nodes.filter((n) =>
			filteredNecessary.has(n.id),
		);
		if (necessaryNodes.length !== filteredNecessary.size) {
			throw new Error("Some necessary nodes not found in canvas.");
		}

		// Create tasks upfront for all necessary nodes
		const tasksMap = new Map<
			Node["id"],
			{ id: Task["id"]; nodeId: Node["id"] }
		>();
		for (const nodeId of necessaryIds) {
			const node = data.nodes.find((n) => n.id === nodeId);
			if (!node) {
				throw new Error(`Node ${nodeId} not found in canvas data`);
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

		// Refetch batch to include tasks
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

		// Set up batch remaining count
		const batchRemainingKey = `batch-remaining:${batch.id}`;
		await redisConnection.set(batchRemainingKey, necessaryIds.length);

		// Compute indegree
		const indegree = new Map<Node["id"], number>();
		for (const id of necessaryIds) {
			indegree.set(id, (revDepGraph.get(id) || []).length);
		}

		// Add jobs to queue with far delay
		for (const nodeId of necessaryIds) {
			const task = tasksMap.get(nodeId);
			if (!task) {
				throw new Error(`Task not found for node ${nodeId}`);
			}
			const isExplicitlySelected = nodeIds ? nodeIds.includes(nodeId) : true;
			const downstream = depGraph.get(nodeId) || [];
			const downstreamTaskIds = downstream
				.map((ds) => tasksMap.get(ds)?.id)
				.filter((id): id is string => !!id);

			await nodeQueue.add(
				"process-node-task",
				{
					taskId: task.id,
					canvasId,
					isExplicitlySelected,
					downstreamTaskIds,
				},
				{
					jobId: task.id,
					delay: Number.MAX_SAFE_INTEGER, // Hold until dependencies met
				},
			);
		}

		// Set remaining deps for each task
		for (const nodeId of necessaryIds) {
			const task = tasksMap.get(nodeId);
			if (!task) continue;
			const deg = indegree.get(nodeId) || 0;
			const depKey = `remaining-deps:${task.id}`;
			await redisConnection.set(depKey, deg);
		}

		// Release root nodes (indegree 0)
		for (const nodeId of necessaryIds) {
			const deg = indegree.get(nodeId) || 0;
			if (deg === 0) {
				const task = tasksMap.get(nodeId);
				if (!task) continue;
				const job = await Job.fromId(nodeQueue, task.id);
				if (job) {
					await job.changeDelay(0);
				}
			}
		}

		return batch;
	}
}
