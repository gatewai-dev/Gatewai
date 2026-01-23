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
	height: z.number().optional().nullable(),
	draggable: z.boolean().optional().default(true),
	selectable: z.boolean().optional().default(true),
	deletable: z.boolean().optional().default(true),
	result: z.any().optional(),
	config: z.any().optional(),
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

export const bulkUpdateSchema = z.object({
	nodes: z.array(nodeSchema).optional(),
	edges: z.array(edgeSchema).optional(),
	handles: z.array(handleSchema).optional(),
});
