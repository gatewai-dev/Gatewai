import { TOKENS } from "@gatewai/node-sdk";
import { container } from "@gatewai/di";
import { prisma } from "@gatewai/db";
import { ENV_CONFIG } from "@gatewai/core";
import { nodeServices, storageService, mediaService, graphResolvers } from "./graph-engine/node-services.js";

/**
 * Register backend-specific services into the DI container.
 */
export function registerBackendServices() {
    // Register generic values
    container.register(TOKENS.PRISMA, { useValue: prisma });
    container.register(TOKENS.ENV, { useValue: ENV_CONFIG });

    // Register Services
    // nodeServices is deprecated but potentially used by legacy processors
    container.register(TOKENS.NODE_SERVICES, { useValue: nodeServices });

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
