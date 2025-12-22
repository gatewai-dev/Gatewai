import { Hono } from "hono";
import { prisma } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";

const tasksRouter = new Hono<{Variables: AuthHonoTypes}>({
    strict: false,
});

/**
 * Get all tasks for a given canvas
 */
tasksRouter.get('/:canvasId', async (c) => {
    const canvasId = c.req.param('canvasId');
    const user = c.get('user');
    const tasks = await prisma.task.findMany({
        where: {
            canvasId,
            userId: user!.id
        }
    })
    return c.json({ result: tasks });
})

export { tasksRouter };