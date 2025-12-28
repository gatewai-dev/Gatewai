import {
	prisma,
	type TaskBatchWhereInput,
	TaskStatus,
	type TaskWhereInput,
} from "@gatewai/db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod/v4";
import type { AuthHonoTypes } from "../../auth.js";

const TaskStatuses = [
	TaskStatus.COMPLETED,
	TaskStatus.FAILED,
	TaskStatus.EXECUTING,
	TaskStatus.QUEUED,
] as const;

const tasksQueryParams = z.object({
	taskStatus: z.array(z.enum(TaskStatuses)).optional(),
	fromDatetime: z.iso.datetime().optional(),
});

const tasksRouter = new Hono<{ Variables: AuthHonoTypes }>({
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
			const user = c.get("user");
			const batchIds = c.req.queries("batchId");
			const batchId = c.req.query("batchId");
			const whereClause: TaskBatchWhereInput = {
				id: { in: batchIds ? batchIds : batchId ? [batchId] : [] },
				userId: user!.id,
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
			return c.json({
				batches,
			});
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
			const user = c.get("user");

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
					userId: user?.id,
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
			return c.json({ batches });
		},
	);

export { tasksRouter };
