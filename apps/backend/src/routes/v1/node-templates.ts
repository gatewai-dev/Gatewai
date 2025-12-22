import { Hono } from "hono";
import { prisma } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";

const nodeTemplatesRoutes = new Hono<{Variables: AuthHonoTypes}>();

// List all node templates (publicly accessible, but gated by auth for consistency)
nodeTemplatesRoutes.get('', async (c) => {
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