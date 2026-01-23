import z from "zod";

export const NodeTypes = [
	"Text",
	"TextMerger",
	"Preview",
	"File",
	"Export",
	"Resize",
	"Paint",
	"Blur",
	"Compositor",
	"Note",
	"ImageGen",
	"LLM",
	"Crop",
	"Modulate",
	"Preview",
	"VideoGen",
	"VideoGenFirstLastFrame",
	"VideoGenExtend",
	"TextToSpeech",
	"SpeechToText",
	"VideoCompositor",
] as const;

export const DataTypes = [
	"Text",
	"Number",
	"Boolean",
	"Image",
	"Video",
	"Audio",
] as const;

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
	width: z.number().optional(),
	height: z.number().optional(),
	draggable: z.boolean().optional().default(true),
	selectable: z.boolean().optional().default(true),
	deletable: z.boolean().optional().default(true),
	// Changed from z.any() to z.record() to provide a valid 'object' type
	result: z
		.record(z.unknown())
		.optional()
		.describe("The output data from this node"),
	config: z
		.record(z.unknown())
		.optional()
		.describe("Configuration parameters for this node"),
	isDirty: z.boolean().optional().default(false),
	zIndex: z.number().optional(),
	templateId: z.string(),
});

export const edgeSchema = z.object({
	id: z.string().optional(),
	source: z.string(),
	target: z.string(),
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

			// Optional: Check data type compatibility if handles exist
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
							message:
								"Data types between source and target handles are incompatible.",
						});
					}
				}
			}
		});

		// Cycle detection using DFS
		function hasCycle(): boolean {
			const visited = new Set<string>();
			const recStack = new Set<string>();

			function dfs(node: string): boolean {
				visited.add(node);
				recStack.add(node);

				for (const neighbor of adj.get(node) || []) {
					if (!visited.has(neighbor)) {
						if (dfs(neighbor)) return true;
					} else if (recStack.has(neighbor)) {
						return true;
					}
				}

				recStack.delete(node);
				return false;
			}

			for (const nodeId of nodeMap.keys()) {
				if (!visited.has(nodeId)) {
					if (dfs(nodeId)) return true;
				}
			}

			return false;
		}

		if (hasCycle()) {
			ctx.addIssue({
				code: "custom",
				path: ["edges"],
				message: "Graph contains a cycle, which is not allowed.",
			});
		}
	});

export type BulkUpdatePayload = z.infer<typeof bulkUpdateSchema>;
