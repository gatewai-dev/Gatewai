import {
	prisma,
	type TaskBatchWhereInput,
	TaskStatus,
	type TaskWhereInput,
} from "@gatewai/db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthorizedHonoTypes } from "../../auth.js";

const TaskStatuses = [
	TaskStatus.COMPLETED,
	TaskStatus.FAILED,
	TaskStatus.EXECUTING,
	TaskStatus.QUEUED,
	TaskStatus.CANCELLED,
] as const;

const tasksQueryParams = z.object({
	taskStatus: z.array(z.enum(TaskStatuses)).optional(),
	fromDatetime: z.string().optional(),
});

const tasksRouter = new Hono<{ Variables: AuthorizedHonoTypes }>({
	strict: false,
})
	.get(
		"/filterby-batch",
		zValidator(
			"query",
			z.object({
				batchId: z.union([z.string(), z.array(z.string())]),
			}),
		),
		async (c) => {
			const batchIds = c.req.queries("batchId");
			const batchId = c.req.query("batchId");
			const whereClause: TaskBatchWhereInput = {
				id: { in: batchIds ? batchIds : batchId ? [batchId] : [] },
			};

			const batches = await prisma.taskBatch.findMany({
				where: whereClause,
				include: {
					tasks: {
						include: {
							node: {
								include: {
									template: true,
								},
							},
						},
					},
				},
			});
			return c.json(batches);
		},
	)
	.get(
		"/:canvasId",
		zValidator("query", tasksQueryParams),
		zValidator(
			"param",
			z.object({
				canvasId: z.string(),
			}),
		),
		async (c) => {
			const dt = c.req.query("fromDatetime");
			const taskStatus = c.req.queries("taskStatus") as
				| TaskStatus[]
				| undefined;
			const canvasId = c.req.param("canvasId");

			const whereClause: TaskWhereInput = {};
			if (dt) {
				whereClause.createdAt = { gte: dt };
			}

			if (taskStatus?.length) {
				whereClause.status = {
					in: taskStatus,
				};
			}

			const batches = await prisma.taskBatch.findMany({
				where: {
					canvasId,
					tasks: {
						some: whereClause,
					},
				},
				include: {
					tasks: {
						include: {
							node: true,
						},
					},
				},
			});
			return c.json(batches);
		},
	)
	.post(
		"/stop-batch/:batchId",
		zValidator(
			"param",
			z.object({
				batchId: z.string(),
			}),
		),
		async (c) => {
			const { batchId } = c.req.valid("param");

			await prisma.$transaction(async (tx) => {
				const batch = await tx.taskBatch.findUnique({
					where: { id: batchId },
					select: { finishedAt: true },
				});

				if (batch?.finishedAt) {
					return;
				}

				await tx.taskBatch.update({
					where: { id: batchId },
					data: { finishedAt: new Date() },
				});

				await tx.task.updateMany({
					where: {
						batchId,
						status: { in: [TaskStatus.QUEUED, TaskStatus.EXECUTING] },
					},
					data: {
						status: TaskStatus.CANCELLED,
						finishedAt: new Date(),
					},
				});
			});

			return c.json({ success: true });
		},
	);

export { tasksRouter };
