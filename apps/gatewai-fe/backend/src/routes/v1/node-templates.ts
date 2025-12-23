import { Hono } from "hono";
import { prisma } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";

const nodeTemplatesRoutes = new Hono<{Variables: AuthHonoTypes}>()
.get('', async (c) => {
    const templates = await prisma.nodeTemplate.findMany({
        include: {
            templateHandles: true,
        },
        orderBy: {
            displayName: 'asc',
        }
    });

    return c.json(templates);
});

export { nodeTemplatesRoutes };