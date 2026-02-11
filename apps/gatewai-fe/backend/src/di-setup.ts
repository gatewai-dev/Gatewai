import { ENV_CONFIG } from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import { prisma } from "@gatewai/db";
import {
	graphResolvers,
	mediaService,
	storageService,
} from "@gatewai/graph-engine";

/**
 * Register backend-specific services into the DI container.
 */
export function registerBackendServices() {
	// Register generic values
	container.register(TOKENS.PRISMA, { useValue: prisma });
	container.register(TOKENS.ENV, { useValue: ENV_CONFIG });

	// Register Storage
	container.register(TOKENS.STORAGE, {
		useValue: storageService,
	});

	// Register Media
	container.register(TOKENS.MEDIA, {
		useValue: mediaService,
	});

	// Register Graph Resolvers
	container.register(TOKENS.GRAPH_RESOLVERS, {
		useValue: graphResolvers,
	});

	return container;
}
