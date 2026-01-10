import {
	type Canvas,
	type Node,
	type PrismaClient,
	type Task,
	type TaskBatch,
	TaskStatus,
} from "@gatewai/db";
import {
	type CanvasCtxData,
	GetCanvasEntities,
} from "../repositories/canvas.js";
import { workflowQueue } from "./queue/workflow.queue.js";

/**
 * Workflow processor for canvas - Dispatcher Layer
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

	// Topo sort - Kahn algo.
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

	public async processNodes(
		canvasId: Canvas["id"],
		/**
		 * Node ID's to run - It'll run all of them in canvas if not provided
		 */
		nodeIds?: Node["id"][],
	): Promise<TaskBatch> {
		// 1. Fetch current canvas state
		const data = await GetCanvasEntities(canvasId);

		// 2. Create the Batch Record
		const batch = await this.prisma.taskBatch.create({
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

		// 3. Find all necessary nodes: selected + all upstream dependencies
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

		// 4. Identify terminal nodes to filter out unnecessary upstream terminals
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

		const filteredNecessary = new Set<Node["id"]>();
		for (const nodeId of necessary) {
			const node = data.nodes.find((n) => n.id === nodeId);
			if (!node) continue;

			const isExplicitlySelected = nodeIdsToRun.includes(nodeId);
			const isTerminal = terminalTypes.has(node.type);

			// Only keep if explicitly selected OR NOT a terminal node (avoid "ghost" tasks)
			if (isExplicitlySelected || !isTerminal) {
				filteredNecessary.add(nodeId);
			}
		}

		const necessaryIds = Array.from(filteredNecessary);

		// 5. Build execution plan (Topological Sort)
		const { depGraph, revDepGraph } = this.buildDepGraphs(necessaryIds, data);
		const topoOrder = this.topologicalSort(necessaryIds, depGraph, revDepGraph);
		if (!topoOrder) {
			throw new Error("Cycle detected in necessary nodes.");
		}

		// 6. Validate
		const necessaryNodes = data.nodes.filter((n) =>
			filteredNecessary.has(n.id),
		);
		if (necessaryNodes.length !== filteredNecessary.size) {
			throw new Error("Some necessary nodes not found in canvas.");
		}

		// 7. Create Task records in DB
		const tasksMap = new Map<
			Node["id"],
			{ id: Task["id"]; nodeId: Node["id"] }
		>();

		// We need to store selection state to pass to worker
		const selectionMap: Record<string, boolean> = {};

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
			selectionMap[task.id] = nodeIds ? nodeIds.includes(nodeId) : true;
		}

		// 8. Dispatch the FIRST task in the sequence to the Queue
		// The worker will handle dispatching subsequent tasks upon completion
		if (topoOrder.length > 0) {
			const firstNodeId = topoOrder[0];
			const firstTask = tasksMap.get(firstNodeId);

			// Map nodeIds to taskIds for the chain sequence
			const taskSequence = topoOrder.map((nid) => tasksMap.get(nid)!.id);
			const [firstTaskId, ...remainingTaskIds] = taskSequence;

			if (firstTask) {
				await workflowQueue.add("process-node", {
					taskId: firstTaskId,
					canvasId,
					batchId: batch.id,
					remainingTaskIds, // The worker will pick the next one from here
					isExplicitlySelected: selectionMap[firstTaskId],
					selectionMap,
				});
			}
		} else {
			// Empty batch (rare, but possible if filters removed everything)
			await this.prisma.taskBatch.update({
				where: { id: batch.id },
				data: { finishedAt: new Date() },
			});
		}

		// Return the batch (Client can poll this for updates)
		return await this.prisma.taskBatch.findUniqueOrThrow({
			where: { id: batch.id },
			include: {
				tasks: {
					include: {
						node: true,
					},
				},
			},
		});
	}
}
