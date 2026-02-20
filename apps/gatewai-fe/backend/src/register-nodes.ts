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
					if (mod.default.configSchema) {
						// Register the schema for strict validation
						// We need to import ConfigSchemaRegistry dynamically or ensure it's available
						// Since this runs in backend, @gatewai/core should be available
						try {
							const { ConfigSchemaRegistry } = await import(
								"@gatewai/core/types"
							);
							ConfigSchemaRegistry.register(
								mod.default.type,
								mod.default.configSchema,
							);
							logger.info(`Registered schema for node: ${entry.name}`);
						} catch (err) {
							// Fallback if import fails (e.g. dev vs prod path issues)
							// or if we decide to export it from @gatewai/core index
							logger.warn(
								`Could not register schema for ${entry.name}, module import failed: ${err}`,
							);
						}
					}
					logger.info(`Registered node: ${entry.name}`);
				} else {
					logger.warn(`Node ${entry.name} has no default export.`);
				}
			} catch (e) {
				logger.error(`Failed to register node ${entry.name}`);
				console.error(e);
			}
		}
	} catch (err) {
		logger.error("Failed to discover nodes:", err);
	}
};
