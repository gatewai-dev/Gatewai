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
import { logger } from "../logger.js";
import {
	type CanvasCtxData,
	GetCanvasEntities,
} from "../repositories/canvas.js";
import { nodeProcessors } from "./processors/index.js";

/**
 * Workflow processor for canvas
 */
export class NodeWFProcessor {
	private prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	// Build dependency graphs within selected nodes.
	private buildDepGraphs(
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

	// Topo sort using Kahn's algo.
	private topologicalSort(
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
		for (const nodeId of topoOrder) {
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

		const executer = async () => {
			for (const nodeId of topoOrder) {
				const task = tasksMap.get(nodeId);
				if (!task) {
					throw new Error(`Task not found for node ${nodeId}`);
				}

				// Defensive check: Ensure node still exists in DB before processing
				const currentNode = await this.prisma.node.findUnique({
					where: { id: nodeId },
					select: { id: true, type: true, name: true },
				});

				if (!currentNode) {
					const now = new Date();
					await this.prisma.task.update({
						where: { id: task.id },
						data: {
							status: TaskStatus.FAILED,
							startedAt: now,
							finishedAt: now,
							durationMs: 0,
							error: { message: "Node removed before processing" },
						},
					});
					continue;
				}

				const startedAt = new Date();
				await this.prisma.task.update({
					where: { id: task.id },
					data: {
						status: TaskStatus.EXECUTING,
						startedAt,
					},
				});

				const node = data.nodes.find((n) => n.id === nodeId);
				if (!node) {
					throw new Error("Node not found");
				}
				const template = await this.prisma.nodeTemplate.findUnique({
					where: { type: currentNode.type },
				});

				// (Optional) Double-check skipping logic if somehow a terminal node sneaked in,
				// though `filteredNecessary` should prevent this.
				const isTerminal = template?.isTerminalNode ?? false;
				const isExplicitlySelected = nodeIds ? nodeIds.includes(nodeId) : true;

				if (isTerminal && !isExplicitlySelected) {
					logger.info(
						`Skipping processing for terminal node: ${node.id} (type: ${node.type}) as it was not explicitly selected`,
					);
					const finishedAt = new Date();
					await this.prisma.task.update({
						where: { id: task.id },
						data: {
							status: TaskStatus.COMPLETED,
							finishedAt,
							durationMs: finishedAt.getTime() - startedAt.getTime(),
						},
					});
					continue;
				}

				const processor = nodeProcessors[node.type];
				if (!processor) {
					throw new Error(`No processor for node type ${node.type}.`);
				}

				try {
					// Await processor, pass current data
					logger.info(`Processing node: ${node.id} with type: ${node.type}`);
					const { success, error, newResult } = await processor({
						node,
						data,
						prisma: this.prisma,
					});

					if (error) {
						console.log(`${node.id}: Error: ${error}`);
					}

					if (newResult) {
						// Update in-memory data for propagation to downstream nodes
						const updatedNode = data.nodes.find((n) => n.id === nodeId);
						if (!updatedNode) {
							throw new Error("Node not found to update");
						}
						updatedNode.result = structuredClone(
							newResult,
						) as unknown as NodeResult;
					}

					const finishedAt = new Date();
					await this.prisma.task.update({
						where: { id: task.id },
						data: {
							status: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
							finishedAt,
							durationMs: finishedAt.getTime() - startedAt.getTime(),
							error: error ? { message: error } : undefined,
						},
					});

					// Persist to DB only if not transient
					if (success && !template?.isTransient && newResult) {
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
								console.log(
									`Node ${node.id} removed during processing, skipping result update`,
								);
							} else {
								throw updateErr;
							}
						}
					}
				} catch (err: unknown) {
					console.log({ err });
					const finishedAt = new Date();
					await this.prisma.task.update({
						where: { id: task.id },
						data: {
							status: TaskStatus.FAILED,
							finishedAt,
							durationMs: finishedAt.getTime() - startedAt.getTime(),
							error:
								err instanceof Error
									? { message: err.message }
									: { message: "Unknown error" },
						},
					});
				}
			}

			const batchFinishedAt = new Date();
			await this.prisma.taskBatch.update({
				where: { id: batch.id },
				data: { finishedAt: batchFinishedAt },
				include: { tasks: true },
			});
		};

		executer();

		return batch;
	}
}
