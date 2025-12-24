import { Hono } from "hono";
import { prisma, type TaskStatus, type TaskWhereInput } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod/v4";


const tasksQueryParams = z.object({
    status: z.string().optional(),
    fromDatetime: z.iso.datetime().optional(),
})

const tasksRouter = new Hono<{Variables: AuthHonoTypes}>({
    strict: false,
})
.get('/:canvasId',
    zValidator('query', tasksQueryParams),
    zValidator('param', z.object({
        canvasId: z.string(),
    })),
    async (c) => {
        const dt = c.req.query('fromDatetime')
        const status = c.req.query('status') as TaskStatus | undefined;
        const canvasId = c.req.param('canvasId');
        const user = c.get('user');

        const whereClause: TaskWhereInput = {
            canvasId,
            userId: user!.id,
        }
        if (dt) {
            whereClause.createdAt = { gte: dt }
        }

        if (status) {
            whereClause.status = status;
        }

        const tasks = await prisma.task.findMany({
            where: whereClause
        })
        return c.json(tasks);
    })

export { tasksRouter };