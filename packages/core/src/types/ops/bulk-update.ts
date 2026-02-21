import z from "zod";
import { edgeSchema, handleSchema, nodeSchema } from "../../schemas/graph.js";

export const processSchema = z.object({
	node_ids: z.array(z.string()).optional(),
});

export const bulkUpdateSchema = z
	.object({
		nodes: z.array(nodeSchema).default([]),
		edges: z.array(edgeSchema).default([]),
		handles: z.array(handleSchema).default([]),
	})
	.superRefine((val, ctx) => {
		const { nodes, edges, handles } = val;

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

				if (isVideoCompositor) {
					const hasOutputHandle = Array.from(nodeHandles).some((hId) => {
						const handle = handleMap.get(hId);
						return handle?.type === "Output";
					});

					if (hasOutputHandle) {
						ctx.addIssue({
							code: "custom",
							path: ["nodes", nodeIndex],
							message:
								"VideoCompositor node cannot have output handles. It has download button on UI.",
						});
					}
				}

				const inputHandleIds = Array.from(nodeHandles).filter((hId) => {
					const handle = handleMap.get(hId);
					return handle?.type === "Input";
				});

				const layerUpdates =
					(node.config.layerUpdates as Record<string, unknown>) ?? {};
				const configKeys = Object.keys(layerUpdates);

				// Validate that all layerUpdates keys are valid input handle IDs
				configKeys.forEach((key) => {
					if (!inputHandleIds.includes(key)) {
						ctx.addIssue({
							code: "custom",
							path: ["nodes", nodeIndex, "config", "layerUpdates", key],
							message: `Config key "${key}" must be a valid input handle ID for ${node.type} node.`,
						});
					}
				});

				// Validate layer configurations
				configKeys.forEach((key) => {
					const layerConfig = layerUpdates[key];
					if (typeof layerConfig !== "object" || layerConfig === null) {
						ctx.addIssue({
							code: "custom",
							path: ["nodes", nodeIndex, "config", "layerUpdates", key],
							message: `Layer configuration for handle "${key}" must be an object.`,
						});
						return;
					}

					// Validate specific properties (unchanged)
					const config = layerConfig as Record<string, unknown>;

					if ("opacity" in config) {
						const opacity = config.opacity;
						if (typeof opacity !== "number" || opacity < 0 || opacity > 1) {
							ctx.addIssue({
								code: "custom",
								path: [
									"nodes",
									nodeIndex,
									"config",
									"layerUpdates",
									key,
									"opacity",
								],
								message: "Opacity must be a number between 0 and 1.",
							});
						}
					}
				});
			}

			if (node.type === "VideoGen") {
				const nodeHandles = nodeHandlesMap.get(node.id);
				if (nodeHandles) {
					const imageInputCount = Array.from(nodeHandles).filter((hId) => {
						const h = handleMap.get(hId);
						return h?.type === "Input" && h?.dataTypes.includes("Image");
					}).length;

					if (imageInputCount > 3) {
						ctx.addIssue({
							code: "custom",
							path: ["nodes", nodeIndex],
							message:
								"VideoGen node can only function with up to 3 reference images.",
						});
					}
				}
			}
		});

		// Build adjacency list for cycle detection
		const adj = new Map<string, string[]>();
		const edgeMap = new Map<string, z.infer<typeof edgeSchema>>();
		const connectionSet = new Set<string>();

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

			if (edge.sourceHandleId && edge.targetHandleId) {
				const connectionKey = `${edge.sourceHandleId}|${edge.targetHandleId}`;
				if (connectionSet.has(connectionKey)) {
					ctx.addIssue({
						code: "custom",
						path: ["edges", index],
						message: "Duplicate connection between handles.",
					});
				}
				connectionSet.add(connectionKey);
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

export const agentBulkUpdateSchema = bulkUpdateSchema.superRefine(
	(val, ctx) => {
		const { edges = [], handles = [] } = val;

		const handleMap = new Map<string, z.infer<typeof handleSchema>>();
		handles.forEach((handle) => {
			if (handle.id) {
				handleMap.set(handle.id, handle);
			}
		});

		edges.forEach((edge, index) => {
			// Data type compatibility validation (Strict for Agents)
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
	},
);

export type BulkUpdatePayload = z.infer<typeof bulkUpdateSchema>;
