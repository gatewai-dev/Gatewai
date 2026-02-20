import { type Canvas, prisma, type Task } from "@gatewai/db";
import { HTTPException } from "hono/http-exception";

async function GetCanvasEntities(id: Canvas["id"]) {
	const canvas = await prisma.canvas.findFirst({
		where: {
			id,
		},
	});

	const nodes = await prisma.node.findMany({
		where: {
			canvasId: canvas?.id,
		},
		include: {
			template: true,
		},
	});

	if (!canvas) {
		throw new HTTPException(404, { message: "Canvas not found" });
	}

	// Get all edges for this canvas separately for cleaner structure
	const edges = await prisma.edge.findMany({
		where: {
			sourceNode: {
				canvasId: id,
			},
		},
	});

	const handles = await prisma.handle.findMany({
		where: {
			nodeId: {
				in: nodes.map((m) => m.id),
			},
		},
	});

	return { canvas, nodes, edges, handles };
}

export type CanvasCtxData = Awaited<ReturnType<typeof GetCanvasEntities>>;

export type CanvasCtxDataWithTasks = CanvasCtxData & {
	tasks: Task[];
	// The task assigned to processor
	task?: Task;
	// The API key of the user executing the task
	apiKey?: string;
};

export { GetCanvasEntities };
