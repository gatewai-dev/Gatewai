import { NodeRegistry, nodeRegistry } from "@gatewai/node-sdk";
import { builtinNodes } from "@gatewai/nodes/server";

// Register built-in nodes
for (const manifest of builtinNodes) {
	nodeRegistry.register(manifest);
}

// Re-export the populated registry
export { nodeRegistry, NodeRegistry };
