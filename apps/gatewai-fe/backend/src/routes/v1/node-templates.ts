import { prisma } from "@gatewai/db";
import { Hono } from "hono";

const nodeTemplatesRoutes = new Hono().get("", async (c) => {
	const templates = await prisma.nodeTemplate.findMany({
		include: {
			templateHandles: true,
		},
		orderBy: {
			displayName: "asc",
		},
	});

	return c.json(templates);
});

export { nodeTemplatesRoutes };
