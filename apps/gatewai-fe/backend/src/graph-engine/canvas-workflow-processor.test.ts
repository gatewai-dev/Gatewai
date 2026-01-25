import type { PrismaClient } from "@gatewai/db";
import { beforeEach, describe, expect, it } from "vitest";
import { NodeWFProcessor } from "./canvas-workflow-processor.js";

describe("NodeWFProcessor", () => {
	let processor: NodeWFProcessor;

	beforeEach(() => {
		// Mock PrismaClient as it's required by the constructor but not used in the methods we're testing
		processor = new NodeWFProcessor({} as PrismaClient);
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
});
