import { DataType } from "@gatewai/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EdgeEntityType } from "@/store/edges";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { NodeGraphProcessor, TaskStatus } from "./node-graph-processor";
import type { ProcessorConfig } from "./types";

// Mock dependencies
vi.mock("./pixi/pixi-worker.service", () => ({
	pixiWorkerService: {
		processCrop: vi.fn(),
		processMask: vi.fn(),
		processBlur: vi.fn(),
		processModulate: vi.fn(),
		processResize: vi.fn(),
	},
}));

vi.mock("./image-compositor", () => ({
	processCompositor: vi.fn(),
}));

vi.mock("@/lib/file", () => ({
	GetAssetEndpoint: vi.fn((entity) => `http://mock-asset/${entity.id}`),
}));

// Mock URL methods
global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = vi.fn();

describe("NodeGraphProcessor", () => {
	let processor: NodeGraphProcessor;

	beforeEach(() => {
		vi.clearAllMocks();
		processor = new NodeGraphProcessor();
	});

	afterEach(() => {
		processor.destroy();
	});

	const createMockNode = (
		id: string,
		type: string,
		config: any = {},
	): NodeEntityType =>
		({
			id,
			type: type as any,
			config,
			name: "Mock",
			position: { x: 0, y: 0 },
			createdAt: new Date(),
			updatedAt: new Date(),
			draggable: true,
			selectable: true,
			isDirty: false,
			zIndex: 10,
			deletable: true,
			width: 100,
			height: 100,
		}) as NodeEntityType;

	const createMockHandle = (
		id: string,
		nodeId: string,
		type: "Input" | "Output",
		dataTypes: DataType[],
		required = false,
	): HandleEntityType =>
		({
			id,
			nodeId,
			type,
			dataTypes,
			required,
		}) as HandleEntityType;

	const createMockEdge = (
		id: string,
		source: string,
		sourceHandle: string,
		target: string,
		targetHandle: string,
	): EdgeEntityType =>
		({
			id,
			source,
			sourceHandleId: sourceHandle,
			target,
			targetHandleId: targetHandle,
		}) as EdgeEntityType;

	describe("Graph Topology and Validation", () => {
		it("should validate a simple valid graph", () => {
			const node1 = createMockNode("n1", "Text", { content: "hello" });
			const node2 = createMockNode("n2", "Preview");

			const h1 = createMockHandle("h1", "n1", "Output", [DataType.Text]);
			const h2 = createMockHandle("h2", "n2", "Input", [DataType.Text]);

			const e1 = createMockEdge("e1", "n1", "h1", "n2", "h2");

			const config: ProcessorConfig = {
				nodes: new Map([
					["n1", node1],
					["n2", node2],
				]),
				edges: [e1],
				handles: [h1, h2],
			};

			processor.updateGraph(config);
			expect(processor.graphValidation).toEqual({});
		});

		it("should detect missing required connections", () => {
			const node1 = createMockNode("n1", "Preview");
			const h1 = createMockHandle("h1", "n1", "Input", [DataType.Text], true);

			const config: ProcessorConfig = {
				nodes: new Map([["n1", node1]]),
				edges: [],
				handles: [h1],
			};

			processor.updateGraph(config);
			expect(processor.graphValidation["n1"]).toEqual({
				h1: "missing_connection",
			});
		});

		it("should detect type mismatches", () => {
			const node1 = createMockNode("n1", "Text");
			const node2 = createMockNode("n2", "Blur"); // Blur expects Image

			const h1 = createMockHandle("h1", "n1", "Output", [DataType.Text]);
			const h2 = createMockHandle("h2", "n2", "Input", [DataType.Image]);

			const e1 = createMockEdge("e1", "n1", "h1", "n2", "h2");

			const config: ProcessorConfig = {
				nodes: new Map([
					["n1", node1],
					["n2", node2],
				]),
				edges: [e1],
				handles: [h1, h2],
			};

			processor.updateGraph(config);
			expect(processor.graphValidation["n2"]).toEqual({
				h2: "type_mismatch",
			});
		});

		it("should allow output handles to remain valid if node has a result, even if inputs are invalid", () => {
			const node1 = createMockNode("n1", "LLM");
			// Simulate a result already existing on the node
			(node1 as any).result = {
				selectedOutputIndex: 1,
				outputs: [
					{
						items: [
							{
								type: DataType.Text,
								data: "output 1",
								outputHandleId: "h1",
							},
						],
					},
					{
						items: [
							{
								type: DataType.Text,
								data: "output 2",
								outputHandleId: "h1",
							},
						],
					},
				],
			};

			const h1 = createMockHandle("h1", "n1", "Output", [DataType.Text]);
			// Required input that is missing
			const h2 = createMockHandle("h2", "n1", "Input", [DataType.Text], true);

			const config: ProcessorConfig = {
				nodes: new Map([["n1", node1]]),
				edges: [],
				handles: [h1, h2],
			};

			processor.updateGraph(config);

			const state = processor.getNodeState("n1");
			// Status should be FAILED due to validation
			expect(state?.status).toBe(TaskStatus.FAILED);
			// But Result should be populated from the node
			expect(state?.result).toEqual((node1 as any).result);
			// And selectedOutputIndex should be preserved (implied by result inequality check passing above)
			expect(state?.result?.selectedOutputIndex).toBe(1);

			// Output handle should be VALID despite node error, because we have a result
			expect(state?.handleStatus["h1"].valid).toBe(true);

			// Input handle should definitely be invalid/missing
			expect(processor.graphValidation["n1"]["h2"]).toBe("missing_connection");
		});
	});

	describe("Execution Flow", () => {
		it("should execute nodes in correct order", async () => {
			const node1 = createMockNode("n1", "Text", { content: "hello" });
			const node2 = createMockNode("n2", "TextMerger", { join: " " });

			const h1 = createMockHandle("h1", "n1", "Output", [DataType.Text]);
			const h2 = createMockHandle("h2", "n2", "Input", [DataType.Text]);
			const h3 = createMockHandle("h3", "n2", "Output", [DataType.Text]);

			const e1 = createMockEdge("e1", "n1", "h1", "n2", "h2");

			const config: ProcessorConfig = {
				nodes: new Map([
					["n1", node1],
					["n2", node2],
				]),
				edges: [e1],
				handles: [h1, h2, h3],
			};

			const processedNodes: string[] = [];
			processor.on("node:processed", ({ nodeId }) => {
				processedNodes.push(nodeId);
			});

			processor.updateGraph(config);

			// Wait for execution loop
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(processedNodes).toEqual(["n1", "n2"]);
			expect(processor.getNodeState("n2")?.status).toBe(TaskStatus.COMPLETED);
			expect(processor.getNodeResult("n2")?.outputs[0].items[0].data).toBe(
				"hello",
			);
		});

		it("should handle processor errors", async () => {
			const node1 = createMockNode("n1", "Text", { content: "hello" });
			const h1 = createMockHandle("h1", "n1", "Output", [DataType.Text]);

			// Mock a processor that fails
			processor.registerProcessor("FailingNode" as any, async () => {
				throw new Error("Processor failed");
			});
			const node2 = createMockNode("n2", "FailingNode");
			const h2 = createMockHandle("h2", "n2", "Input", [DataType.Text]);
			const e1 = createMockEdge("e1", "n1", "h1", "n2", "h2");

			const config: ProcessorConfig = {
				nodes: new Map([
					["n1", node1],
					["n2", node2],
				]),
				edges: [e1],
				handles: [h1, h2],
			};

			processor.updateGraph(config);

			await new Promise((resolve) => setTimeout(resolve, 100));

			const state2 = processor.getNodeState("n2");
			expect(state2?.status).toBe(TaskStatus.FAILED);
			expect(state2?.error).toBe("Processor failed");
		});

		it("should stall downstream nodes if upstream fails", async () => {
			processor.registerProcessor("FailingNode" as any, async () => {
				throw new Error("Processor failed");
			});

			const node1 = createMockNode("n1", "FailingNode");
			const node2 = createMockNode("n2", "Preview");

			const h1 = createMockHandle("h1", "n1", "Output", [DataType.Text]);
			const h2 = createMockHandle("h2", "n2", "Input", [DataType.Text], true);
			const e1 = createMockEdge("e1", "n1", "h1", "n2", "h2");

			const config: ProcessorConfig = {
				nodes: new Map([
					["n1", node1],
					["n2", node2],
				]),
				edges: [e1],
				handles: [h1, h2],
			};

			processor.updateGraph(config);

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(processor.getNodeState("n1")?.status).toBe(TaskStatus.FAILED);
			expect(processor.getNodeState("n2")?.status).toBe(TaskStatus.FAILED);
			expect(processor.getNodeState("n2")?.error).toBe(
				"Missing required inputs due to upstream errors",
			);
		});
	});

	describe("Change Detection", () => {
		it("should re-process when node config changes", async () => {
			const node1 = createMockNode("n1", "Text", { content: "v1" });
			const h1 = createMockHandle("h1", "n1", "Output", [DataType.Text]);

			const config1: ProcessorConfig = {
				nodes: new Map([["n1", node1]]),
				edges: [],
				handles: [h1],
			};

			processor.updateGraph(config1);
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(processor.getNodeResult("n1")?.outputs[0].items[0].data).toBe(
				"v1",
			);

			const node1v2 = createMockNode("n1", "Text", { content: "v2" });
			const config2: ProcessorConfig = {
				nodes: new Map([["n1", node1v2]]),
				edges: [],
				handles: [h1],
			};

			processor.updateGraph(config2);
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(processor.getNodeResult("n1")?.outputs[0].items[0].data).toBe(
				"v2",
			);
		});

		it("should re-process downstream when upstream changes", async () => {
			const node1 = createMockNode("n1", "Text", { content: "v1" });
			const node2 = createMockNode("n2", "Preview");
			const h1 = createMockHandle("h1", "n1", "Output", [DataType.Text]);
			const h2 = createMockHandle("h2", "n2", "Input", [DataType.Text]);
			const e1 = createMockEdge("e1", "n1", "h1", "n2", "h2");

			processor.updateGraph({
				nodes: new Map([
					["n1", node1],
					["n2", node2],
				]),
				edges: [e1],
				handles: [h1, h2],
			});
			await new Promise((resolve) => setTimeout(resolve, 50));

			const node1v2 = createMockNode("n1", "Text", { content: "v2" });
			let n2ProcessedCount = 0;
			processor.on("node:processed", ({ nodeId }) => {
				if (nodeId === "n2") n2ProcessedCount++;
			});

			processor.updateGraph({
				nodes: new Map([
					["n1", node1v2],
					["n2", node2],
				]),
				edges: [e1],
				handles: [h1, h2],
			});
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(n2ProcessedCount).toBe(1);
			expect(processor.getNodeResult("n2")?.outputs[0].items[0].data).toBe(
				"v2",
			);
		});
	});

	describe("Handle State and Runtime Validation", () => {
		it("should update handle colors based on connectivity", async () => {
			const node1 = createMockNode("n1", "Text", { content: "hello" });
			const h1 = createMockHandle("h1", "n1", "Output", [DataType.Text]);

			processor.updateGraph({
				nodes: new Map([["n1", node1]]),
				edges: [],
				handles: [h1],
			});

			// Initially disconnected, but since it has a single type (Text), it should have that type's color
			expect(processor.getHandleColor("n1", "h1")).not.toBeNull();

			const node2 = createMockNode("n2", "Preview");
			const h2 = createMockHandle("h2", "n2", "Input", [DataType.Text]);
			const e1 = createMockEdge("e1", "n1", "h1", "n2", "h2");

			processor.updateGraph({
				nodes: new Map([
					["n1", node1],
					["n2", node2],
				]),
				edges: [e1],
				handles: [h1, h2],
			});

			// Wait for processing to get result and update colors
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(processor.getHandleColor("n1", "h1")).not.toBeNull();
			expect(processor.getHandleColor("n2", "h2")).not.toBeNull();
		});

		it("should detect runtime type mismatches", async () => {
			// A node that says it outputs Image but actually outputs Text
			processor.registerProcessor("LyingNode" as any, async () => ({
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: "Text" as any,
								data: "I am text",
								outputHandleId: "h1",
							},
						],
					},
				],
			}));

			const node1 = createMockNode("n1", "LyingNode");
			const node2 = createMockNode("n2", "Blur"); // Blur expects Image

			const h1 = createMockHandle("h1", "n1", "Output", [DataType.Image]);
			const h2 = createMockHandle("h2", "n2", "Input", [DataType.Image]);
			const e1 = createMockEdge("e1", "n1", "h1", "n2", "h2");

			processor.updateGraph({
				nodes: new Map([
					["n1", node1],
					["n2", node2],
				]),
				edges: [e1],
				handles: [h1, h2],
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			const state2 = processor.getNodeState("n2");
			expect(state2?.status).toBe(TaskStatus.FAILED);
			expect(state2?.error).toBe("Invalid input types for some connections");
			expect(state2?.handleStatus["h2"].valid).toBe(false);
		});
	});

	describe("Resource Management", () => {
		it("should revoke object URLs on destruction", () => {
			processor["registerObjectUrl"]("n1", "blob:1");
			processor["registerObjectUrl"]("n1", "blob:2");

			processor.destroy();

			expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
			expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:2");
		});

		it("should revoke object URLs on re-execution", async () => {
			const node1 = createMockNode("n1", "Text", { content: "v1" });
			const h1 = createMockHandle("h1", "n1", "Output", [DataType.Text]);

			// We need a processor that creates an object URL
			processor.registerProcessor("UrlNode" as any, async ({ node }) => {
				const url = URL.createObjectURL(new Blob());
				processor["registerObjectUrl"](node.id, url);
				return {
					selectedOutputIndex: 0,
					outputs: [
						{
							items: [{ type: "Text" as any, data: url, outputHandleId: "h1" }],
						},
					],
				};
			});

			const node2 = createMockNode("n2", "UrlNode");
			processor.updateGraph({
				nodes: new Map([["n2", node2]]),
				edges: [],
				handles: [h1],
			});

			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
			const firstUrl = (global.URL.createObjectURL as any).mock.results[0]
				.value;

			// Trigger re-execution
			(processor as any).markNodesDirty(["n2"]);
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl);
			expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);
		});
	});
});
