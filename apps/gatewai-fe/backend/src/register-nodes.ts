import { logger } from "@gatewai/core";
import { nodeRegistry } from "@gatewai/graph-engine";
import { discoverNodes } from "./node-discovery";

// Discover and register nodes
export const registerNodes = async () => {
	try {
		const nodes = await discoverNodes();
		logger.info(`Discovered ${nodes.length} nodes from filesystem.`);
		for (const entry of nodes) {
			try {
				const mod = await entry.server();
				// Register both manifest + backendProcessor
				// The module default export is the BackendNodePlugin which contains definition
				if (mod.default) {
					nodeRegistry.register(mod.default);
					logger.info(`Registered node: ${entry.name}`);
				} else {
					logger.warn(`Node ${entry.name} has no default export.`);
				}
			} catch (e) {
				logger.error(`Failed to register node ${entry.name}:`, e);
			}
		}
	} catch (err) {
		logger.error("Failed to discover nodes:", err);
	}
};
