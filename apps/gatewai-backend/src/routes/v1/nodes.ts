import { logger } from "@gatewai/core";
import { nodeRegistry } from "@gatewai/graph-engine";
import { Hono } from "hono";

// Dynamically create a router that mounts all registered node routes
const nodesRouter = new Hono();

const manifests = nodeRegistry.getAllManifests();

for (const manifest of manifests) {
	if (manifest.route) {
		// key is node type, e.g. "io.gatewai.file" -> /io.gatewai.file
		// users might want shorter aliases, but type is unique.
		// We can use the type directly.
		nodesRouter.route(`/${manifest.type}`, manifest.route);
		logger.info(`Mounted route for node: ${manifest.type}`);
	}
}

export { nodesRouter };
