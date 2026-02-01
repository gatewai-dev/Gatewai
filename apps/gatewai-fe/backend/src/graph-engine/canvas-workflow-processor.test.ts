import type { PrismaClient } from "@gatewai/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetCanvasEntities } from "../data-ops/canvas.js";
import { NodeWFProcessor } from "./canvas-workflow-processor.js";
import { workflowQueue } from "./queue/workflow.queue.js";

// Mock dependencies
vi.mock("../data-ops/canvas.js", () => ({
	GetCanvasEntities: vi.fn(),
}));

vi.mock("./queue/workflow.queue.js", () => ({
	workflowQueue: {
		add: vi.fn(),
	},
}));

describe("NodeWFProcessor", () => {
	let processor: NodeWFProcessor;
	let mockPrisma: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Create mock Prisma Client
		mockPrisma = {
			taskBatch: {
				create: vi.fn(),
				findFirst: vi.fn(),
				update: vi.fn(),
				findUniqueOrThrow: vi.fn(),
			},
			task: {
				create: vi.fn(),
			},
		};

		processor = new NodeWFProcessor(mockPrisma as PrismaClient);
	});

	describe("buildDepGraphs", () => {
		it("should build dependency graphs for a simple linear chain", () => {
			const nodeIds = ["1", "2", "3"];
			const data = {
				nodes: [{ id: "1" }, { id: "2" }, { id: "3" }] as any,
				edges: [
					{ source: "1", target: "2" },
					{ source: "2", target: "3" },
				] as any,
			};

			const { depGraph, revDepGraph } = processor.buildDepGraphs(
				nodeIds,
				data as any,
			);

			expect(depGraph.get("1")).toEqual(["2"]);
			expect(depGraph.get("2")).toEqual(["3"]);
			expect(depGraph.get("3")).toEqual([]);

			expect(revDepGraph.get("1")).toEqual([]);
			expect(revDepGraph.get("2")).toEqual(["1"]);
			expect(revDepGraph.get("3")).toEqual(["2"]);
		});

		it("should only include dependencies between selected nodes", () => {
			const nodeIds = ["1", "3"];
			const data = {
				nodes: [{ id: "1" }, { id: "2" }, { id: "3" }] as any,
				edges: [
					{ source: "1", target: "2" },
					{ source: "2", target: "3" },
				] as any,
			};

			const { depGraph, revDepGraph } = processor.buildDepGraphs(
				nodeIds,
				data as any,
			);

			expect(depGraph.get("1")).toEqual([]);
			expect(depGraph.get("3")).toEqual([]);
			expect(revDepGraph.get("1")).toEqual([]);
			expect(revDepGraph.get("3")).toEqual([]);
		});

		it("should handle branching and merging", () => {
			const nodeIds = ["1", "2", "3", "4"];
			const data = {
				nodes: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }] as any,
				edges: [
					{ source: "1", target: "2" },
					{ source: "1", target: "3" },
					{ source: "2", target: "4" },
					{ source: "3", target: "4" },
				] as any,
			};

			const { depGraph, revDepGraph } = processor.buildDepGraphs(
				nodeIds,
				data as any,
			);

			expect(depGraph.get("1")).toContain("2");
			expect(depGraph.get("1")).toContain("3");
			expect(depGraph.get("4")).toEqual([]);

			expect(revDepGraph.get("4")).toContain("2");
			expect(revDepGraph.get("4")).toContain("3");
			expect(revDepGraph.get("1")).toEqual([]);
		});
	});

	describe("topologicalSort", () => {
		it("should return nodes in correct order for a linear chain", () => {
			const nodes = ["1", "2", "3"];
			const depGraph = new Map([
				["1", ["2"]],
				["2", ["3"]],
				["3", []],
			]);
			const revDepGraph = new Map([
				["1", []],
				["2", ["1"]],
				["3", ["2"]],
			]);

			const result = processor.topologicalSort(nodes, depGraph, revDepGraph);
			expect(result).toEqual(["1", "2", "3"]);
		});

		it("should return nodes in correct order for a branching graph", () => {
			const nodes = ["1", "2", "3", "4"];
			const depGraph = new Map([
				["1", ["2", "3"]],
				["2", ["4"]],
				["3", ["4"]],
				["4", []],
			]);
			const revDepGraph = new Map([
				["1", []],
				["2", ["1"]],
				["3", ["1"]],
				["4", ["2", "3"]],
			]);

			const result = processor.topologicalSort(nodes, depGraph, revDepGraph);

			expect(result![0]).toBe("1");
			expect(result![3]).toBe("4");
			// 2 and 3 can be in any order
			expect(new Set(result!.slice(1, 3))).toEqual(new Set(["2", "3"]));
		});

		it("should return null if a cycle is detected", () => {
			const nodes = ["1", "2"];
			const depGraph = new Map([
				["1", ["2"]],
				["2", ["1"]],
			]);
			const revDepGraph = new Map([
				["1", ["2"]],
				["2", ["1"]],
			]);

			const result = processor.topologicalSort(nodes, depGraph, revDepGraph);
			expect(result).toBeNull();
		});

		it("should throw error if a node is missing from revDepGraph", () => {
			const nodes = ["1", "2"];
			const depGraph = new Map([
				["1", ["2"]],
				["2", []],
			]);
			const revDepGraph = new Map([["1", []]]); // Missing '2'

			expect(() =>
				processor.topologicalSort(nodes, depGraph, revDepGraph),
			).toThrow("Missing reverse dependencies for node 2");
		});
	});

	describe("processNodes", () => {
		it("should process all nodes when no nodeIds provided", async () => {
			const canvasId = "canvas-1";
			const mockData = {
				nodes: [
					{ id: "1", name: "Node 1" },
					{ id: "2", name: "Node 2" },
				],
				edges: [{ source: "1", target: "2" }],
			};

			(GetCanvasEntities as any).mockResolvedValue(mockData);
			mockPrisma.taskBatch.create.mockResolvedValue({ id: "batch-1" });
			mockPrisma.task.create.mockImplementation((args: any) =>
				Promise.resolve({ id: `task-${args.data.nodeId}` }),
			);
			mockPrisma.taskBatch.findFirst.mockResolvedValue(null); // No active batch
			mockPrisma.taskBatch.findUniqueOrThrow.mockResolvedValue({
				id: "batch-1",
				tasks: [],
			});

			await processor.processNodes(canvasId);

			expect(GetCanvasEntities).toHaveBeenCalledWith(canvasId);
			expect(mockPrisma.taskBatch.create).toHaveBeenCalled();
			expect(mockPrisma.task.create).toHaveBeenCalledTimes(2);
			expect(mockPrisma.taskBatch.update).toHaveBeenCalledWith({
				where: { id: "batch-1" },
				data: { startedAt: expect.any(Date) },
			});
			expect(workflowQueue.add).toHaveBeenCalled();
		});

		it("should process selected nodes and their upstream dependencies", async () => {
			const canvasId = "canvas-1";
			// 1 -> 2 -> 3. Select 3, should include 1, 2, 3.
			const mockData = {
				nodes: [
					{ id: "1", name: "Node 1" },
					{ id: "2", name: "Node 2" },
					{ id: "3", name: "Node 3" },
				],
				edges: [
					{ source: "1", target: "2" },
					{ source: "2", target: "3" },
				],
			};

			(GetCanvasEntities as any).mockResolvedValue(mockData);
			mockPrisma.taskBatch.create.mockResolvedValue({ id: "batch-1" });
			mockPrisma.task.create.mockImplementation((args: any) =>
				Promise.resolve({ id: `task-${args.data.nodeId}` }),
			);
			mockPrisma.taskBatch.findFirst.mockResolvedValue(null);
			mockPrisma.taskBatch.findUniqueOrThrow.mockResolvedValue({
				id: "batch-1",
				tasks: [],
			});

			await processor.processNodes(canvasId, ["3"]);

			// Topological sort of 1,2,3 is 1->2->3
			expect(mockPrisma.task.create).toHaveBeenCalledTimes(3);
			// Check order of task creation which follows topo sort
			expect(mockPrisma.task.create).toHaveBeenNthCalledWith(1, {
				data: expect.objectContaining({ nodeId: "1" }),
			});
			expect(mockPrisma.task.create).toHaveBeenNthCalledWith(2, {
				data: expect.objectContaining({ nodeId: "2" }),
			});
			expect(mockPrisma.task.create).toHaveBeenNthCalledWith(3, {
				data: expect.objectContaining({ nodeId: "3" }),
			});
		});

		it("should queue job if another batch is running", async () => {
			const canvasId = "canvas-1";
			const mockData = {
				nodes: [{ id: "1", name: "Node 1" }],
				edges: [],
			};

			(GetCanvasEntities as any).mockResolvedValue(mockData);
			mockPrisma.taskBatch.create.mockResolvedValue({ id: "batch-2" });
			mockPrisma.task.create.mockResolvedValue({ id: "task-1" });
			// Simulate active batch
			mockPrisma.taskBatch.findFirst.mockResolvedValue({ id: "batch-1" });
			mockPrisma.taskBatch.findUniqueOrThrow.mockResolvedValue({
				id: "batch-2",
				tasks: [],
			});

			await processor.processNodes(canvasId);

			expect(mockPrisma.taskBatch.update).toHaveBeenCalledWith({
				where: { id: "batch-2" },
				data: { pendingJobData: expect.any(Object) },
			});
			expect(workflowQueue.add).not.toHaveBeenCalled();
		});

		it("should start immediately if no active batch", async () => {
			const canvasId = "canvas-1";
			const mockData = {
				nodes: [{ id: "1", name: "Node 1" }],
				edges: [],
			};

			(GetCanvasEntities as any).mockResolvedValue(mockData);
			mockPrisma.taskBatch.create.mockResolvedValue({ id: "batch-1" });
			mockPrisma.task.create.mockResolvedValue({ id: "task-1" });
			mockPrisma.taskBatch.findFirst.mockResolvedValue(null);
			mockPrisma.taskBatch.findUniqueOrThrow.mockResolvedValue({
				id: "batch-1",
				tasks: [],
			});

			await processor.processNodes(canvasId);

			expect(mockPrisma.taskBatch.update).toHaveBeenCalledWith({
				where: { id: "batch-1" },
				data: { startedAt: expect.any(Date) },
			});
			expect(workflowQueue.add).toHaveBeenCalled();
		});

		it("should throw error if cycle detected", async () => {
			const canvasId = "canvas-1";
			// 1 -> 2 -> 1 Cycle
			const mockData = {
				nodes: [
					{ id: "1", name: "Node 1" },
					{ id: "2", name: "Node 2" },
				],
				edges: [
					{ source: "1", target: "2" },
					{ source: "2", target: "1" },
				],
			};

			(GetCanvasEntities as any).mockResolvedValue(mockData);
			mockPrisma.taskBatch.create.mockResolvedValue({ id: "batch-1" });

			await expect(processor.processNodes(canvasId)).rejects.toThrow(
				"Cycle detected in necessary nodes.",
			);
		});

		it("should throw error if necessary nodes missing", async () => {
			const canvasId = "canvas-1";
			const mockData = {
				nodes: [{ id: "1", name: "Node 1" }],
				edges: [],
			};
			// Mock data returns node 1, but we request node 2
			(GetCanvasEntities as any).mockResolvedValue(mockData);
			mockPrisma.taskBatch.create.mockResolvedValue({ id: "batch-1" });

			await expect(processor.processNodes(canvasId, ["2"])).rejects.toThrow(); // Will throw "Some necessary nodes not found" or "Node 2 not found" depending on logic flow, but "necessary nodes not found" is checked earlier if we filter
			// Actually the logic:
			// 1. buildDepGraphs for all nodes (needs 2 to be in data? No, it uses data.nodes)
			// Wait, processNodes logic Step 3: queue initial nodes.
			// "2" is in queue.
			// Step 4: necessaryIds = ["2"]
			// Step 6: necessaryNodes = data.nodes.filter(n => necessary.has(n.id))
			// if (necessaryNodes.length !== necessary.size) throw Error
		});

		it("should handle empty batch (no nodes to run)", async () => {
			const canvasId = "canvas-1";
			const mockData = { nodes: [], edges: [] };
			(GetCanvasEntities as any).mockResolvedValue(mockData);
			mockPrisma.taskBatch.create.mockResolvedValue({ id: "batch-1" });
			mockPrisma.taskBatch.findUniqueOrThrow.mockResolvedValue({
				id: "batch-1",
				tasks: [],
			});

			await processor.processNodes(canvasId, []);

			expect(mockPrisma.taskBatch.update).toHaveBeenCalledWith({
				where: { id: "batch-1" },
				data: { finishedAt: expect.any(Date) },
			});
		});
	});
});
