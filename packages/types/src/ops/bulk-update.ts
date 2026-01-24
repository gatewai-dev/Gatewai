import z from "zod";
import { DataTypes, NodeTypes } from "../base.js";
import { NodeConfigSchema } from "../config/schemas.js";
import { NodeResultSchema } from "../node-result.js";

export const handleSchema = z.object({
	id: z.string().optional(),
	type: z.enum(["Input", "Output"]),
	dataTypes: z.array(z.enum(DataTypes)),
	label: z.string(),
	order: z.number().default(0),
	required: z.boolean().default(false),
	templateHandleId: z.string().optional().nullable(),
	nodeId: z.string(),
});

export const nodeSchema = z.object({
	id: z.string().optional(),
	name: z.string(),
	type: z.enum(NodeTypes),
	position: z.object({
		x: z.number(),
		y: z.number(),
	}),
	handles: z.array(handleSchema).optional(),
	width: z.number().optional().default(340),
	height: z
		.number()
		.optional()
		.describe("It is better to keep this undefined for auto-style"),
	draggable: z.boolean().optional().default(true),
	selectable: z.boolean().optional().default(true),
	deletable: z.boolean().optional().default(true),
	result: NodeResultSchema.describe(
		"The output data from this node - CANNOT BE SET BY AI AGENT",
	),
	config: NodeConfigSchema.optional()
		.nullable()
		.describe("Configuration parameters for this node"),
	isDirty: z.boolean().optional().default(false),
	zIndex: z.number().optional(),
	templateId: z.string(),
});

export const edgeSchema = z.object({
	id: z.string().optional(),
	source: z.string().describe("Source Node ID"),
	target: z.string().describe("Target Node ID"),
	sourceHandleId: z.string().optional(),
	targetHandleId: z.string().optional(),
});

export const processSchema = z.object({
	node_ids: z.array(z.string()).optional(),
});

export const bulkUpdateSchema = z
	.object({
		nodes: z.array(nodeSchema).optional(),
		edges: z.array(edgeSchema).optional(),
		handles: z.array(handleSchema).optional(),
	})
	.superRefine((val, ctx) => {
		const { nodes = [], edges = [], handles = [] } = val;

		// Build maps for quick lookups
		const nodeMap = new Map<string, z.infer<typeof nodeSchema>>();
		nodes.forEach((node, index) => {
			if (node.id) {
				if (nodeMap.has(node.id)) {
					ctx.addIssue({
						code: "custom",
						path: ["nodes", index, "id"],
						message: "Duplicate node ID detected.",
					});
				}
				nodeMap.set(node.id, node);
			} else {
				ctx.addIssue({
					code: "custom",
					path: ["nodes", index, "id"],
					message: "Node ID is required.",
				});
			}
		});

		const handleMap = new Map<string, z.infer<typeof handleSchema>>();
		const nodeHandlesMap = new Map<string, Set<string>>();

		handles.forEach((handle, index) => {
			if (handle.id) {
				if (handleMap.has(handle.id)) {
					ctx.addIssue({
						code: "custom",
						path: ["handles", index, "id"],
						message: "Duplicate handle ID detected.",
					});
				}
				handleMap.set(handle.id, handle);

				// Track handles by node
				if (!nodeHandlesMap.has(handle.nodeId)) {
					nodeHandlesMap.set(handle.nodeId, new Set());
				}
				nodeHandlesMap.get(handle.nodeId)!.add(handle.id);
			} else {
				ctx.addIssue({
					code: "custom",
					path: ["handles", index, "id"],
					message: "Handle ID is required.",
				});
			}

			// Validate handle's nodeId exists
			if (!nodeMap.has(handle.nodeId)) {
				ctx.addIssue({
					code: "custom",
					path: ["handles", index, "nodeId"],
					message: "Referenced node ID does not exist.",
				});
			}
		});

		// Validate Compositor and VideoCompositor config keys
		nodes.forEach((node, nodeIndex) => {
			if (!node.id || !node.config) return;

			const isCompositor = node.type === "Compositor";
			const isVideoCompositor = node.type === "VideoCompositor";

			if (isCompositor || isVideoCompositor) {
				const nodeHandles = nodeHandlesMap.get(node.id);
				if (!nodeHandles) return;

				const inputHandleIds = Array.from(nodeHandles).filter((hId) => {
					const handle = handleMap.get(hId);
					return handle?.type === "Input";
				});

				const configKeys = Object.keys(node.config);

				// Validate that all config keys are valid input handle IDs
				configKeys.forEach((key) => {
					if (!inputHandleIds.includes(key)) {
						ctx.addIssue({
							code: "custom",
							path: ["nodes", nodeIndex, "config", key],
							message: `Config key "${key}" must be a valid input handle ID for ${node.type} node.`,
						});
					}
				});

				// Validate layer configurations
				configKeys.forEach((key) => {
					const layerConfig = node.config![key];
					if (typeof layerConfig !== "object" || layerConfig === null) {
						ctx.addIssue({
							code: "custom",
							path: ["nodes", nodeIndex, "config", key],
							message: `Layer configuration for handle "${key}" must be an object.`,
						});
						return;
					}

					// Validate specific properties
					const config = layerConfig as Record<string, unknown>;

					if ("opacity" in config) {
						const opacity = config.opacity;
						if (typeof opacity !== "number" || opacity < 0 || opacity > 1) {
							ctx.addIssue({
								code: "custom",
								path: ["nodes", nodeIndex, "config", key, "opacity"],
								message: "Opacity must be a number between 0 and 1.",
							});
						}
					}
				});
			}
		});

		// Build adjacency list for cycle detection
		const adj = new Map<string, string[]>();
		const edgeMap = new Map<string, z.infer<typeof edgeSchema>>();

		edges.forEach((edge, index) => {
			if (edge.id) {
				if (edgeMap.has(edge.id)) {
					ctx.addIssue({
						code: "custom",
						path: ["edges", index, "id"],
						message: "Duplicate edge ID detected.",
					});
				}
				edgeMap.set(edge.id, edge);
			} else {
				ctx.addIssue({
					code: "custom",
					path: ["edges", index, "id"],
					message: "Edge ID is required.",
				});
			}

			// Require source and target
			if (!edge.source) {
				ctx.addIssue({
					code: "custom",
					path: ["edges", index, "source"],
					message: "Source node ID is required.",
				});
			}
			if (!edge.target) {
				ctx.addIssue({
					code: "custom",
					path: ["edges", index, "target"],
					message: "Target node ID is required.",
				});
			}

			if (edge.source && edge.target) {
				// No self-connections
				if (edge.source === edge.target) {
					ctx.addIssue({
						code: "custom",
						path: ["edges", index],
						message: "Self-connections are not allowed.",
					});
				}

				// Nodes must exist
				if (!nodeMap.has(edge.source)) {
					ctx.addIssue({
						code: "custom",
						path: ["edges", index, "source"],
						message: "Source node does not exist.",
					});
				}
				if (!nodeMap.has(edge.target)) {
					ctx.addIssue({
						code: "custom",
						path: ["edges", index, "target"],
						message: "Target node does not exist.",
					});
				}

				// Add to adjacency list for cycle check
				if (!adj.has(edge.source)) {
					adj.set(edge.source, []);
				}
				adj.get(edge.source)!.push(edge.target);
			}

			// Validate handles if provided
			if (edge.sourceHandleId) {
				if (!handleMap.has(edge.sourceHandleId)) {
					ctx.addIssue({
						code: "custom",
						path: ["edges", index, "sourceHandleId"],
						message: "Source handle does not exist.",
					});
				} else {
					const sh = handleMap.get(edge.sourceHandleId)!;
					if (sh.nodeId !== edge.source) {
						ctx.addIssue({
							code: "custom",
							path: ["edges", index, "sourceHandleId"],
							message: "Source handle does not belong to source node.",
						});
					}
					if (sh.type !== "Output") {
						ctx.addIssue({
							code: "custom",
							path: ["edges", index, "sourceHandleId"],
							message: "Source handle must be of type 'Output'.",
						});
					}
				}
			} else {
				ctx.addIssue({
					code: "custom",
					path: ["edges", index, "sourceHandleId"],
					message: "Source handle ID is required.",
				});
			}

			if (edge.targetHandleId) {
				if (!handleMap.has(edge.targetHandleId)) {
					ctx.addIssue({
						code: "custom",
						path: ["edges", index, "targetHandleId"],
						message: "Target handle does not exist.",
					});
				} else {
					const th = handleMap.get(edge.targetHandleId)!;
					if (th.nodeId !== edge.target) {
						ctx.addIssue({
							code: "custom",
							path: ["edges", index, "targetHandleId"],
							message: "Target handle does not belong to target node.",
						});
					}
					if (th.type !== "Input") {
						ctx.addIssue({
							code: "custom",
							path: ["edges", index, "targetHandleId"],
							message: "Target handle must be of type 'Input'.",
						});
					}
				}
			} else {
				ctx.addIssue({
					code: "custom",
					path: ["edges", index, "targetHandleId"],
					message: "Target handle ID is required.",
				});
			}

			// Data type compatibility validation
			if (edge.sourceHandleId && edge.targetHandleId) {
				const sh = handleMap.get(edge.sourceHandleId);
				const th = handleMap.get(edge.targetHandleId);
				if (sh && th) {
					const compatible = sh.dataTypes.some((dt) =>
						th.dataTypes.includes(dt),
					);
					if (!compatible) {
						ctx.addIssue({
							code: "custom",
							path: ["edges", index],
							message: `Data types between source (${sh.dataTypes.join(", ")}) and target (${th.dataTypes.join(", ")}) handles are incompatible.`,
						});
					}
				}
			}
		});

		// Cycle detection using DFS with path tracking
		function hasCycle(): { hasCycle: boolean; path?: string[] } {
			const visited = new Set<string>();
			const recStack = new Set<string>();
			const path: string[] = [];

			function dfs(node: string): boolean {
				visited.add(node);
				recStack.add(node);
				path.push(node);

				for (const neighbor of adj.get(node) || []) {
					if (!visited.has(neighbor)) {
						if (dfs(neighbor)) return true;
					} else if (recStack.has(neighbor)) {
						path.push(neighbor);
						return true;
					}
				}

				recStack.delete(node);
				path.pop();
				return false;
			}

			for (const nodeId of nodeMap.keys()) {
				if (!visited.has(nodeId)) {
					if (dfs(nodeId)) {
						return { hasCycle: true, path };
					}
				}
			}

			return { hasCycle: false };
		}

		const cycleResult = hasCycle();
		if (cycleResult.hasCycle) {
			const cyclePath = cycleResult.path?.join(" → ") || "unknown";
			ctx.addIssue({
				code: "custom",
				path: ["edges"],
				message: `Graph contains a cycle, which is not allowed. Cycle path: ${cyclePath}`,
			});
		}
	});

export type BulkUpdatePayload = z.infer<typeof bulkUpdateSchema>;
