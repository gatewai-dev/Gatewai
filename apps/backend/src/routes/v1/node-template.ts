import { Hono } from "hono";
import { prisma } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";
import { HTTPException } from "hono/http-exception";

const nodeTemplatesRoutes = new Hono<{Variables: AuthHonoTypes}>({
    strict: false,
});

// List all node templates (publicly accessible, but gated by auth for consistency)
nodeTemplatesRoutes.get('/', async (c) => {
    const user = c.get('user');
    if (!user) {
        throw new HTTPException(401, { message: 'Unauthorized' });
    }

    const templates = await prisma.nodeTemplate.findMany({
        include: {
            inputTypes: true,
            outputTypes: true,
        },
        orderBy: {
            displayName: 'asc',
        }
    });

    return c.json({ templates });
});

export { nodeTemplatesRoutes };