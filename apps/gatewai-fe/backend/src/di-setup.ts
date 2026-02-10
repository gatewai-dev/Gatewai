import { TOKENS } from "@gatewai/node-sdk";
import { container } from "@gatewai/di";
import { prisma } from "@gatewai/db";
import { ENV_CONFIG } from "@gatewai/core";
import { nodeServices } from "./graph-engine/node-services.js";
import {
    generateSignedUrl,
    getFromGCS,
    uploadToGCS,
    uploadToTemporaryFolder,
} from "./utils/storage.js";
import { backendPixiService } from "./media/pixi-service.js";

/**
 * Register backend-specific services into the DI container.
 */
export function registerBackendServices() {
    // Register generic values
    container.register(TOKENS.PRISMA, { useValue: prisma });
    container.register(TOKENS.ENV, { useValue: ENV_CONFIG });

    // Register Services
    container.register(TOKENS.NODE_SERVICES, { useValue: nodeServices });

    // Register Storage
    container.register(TOKENS.STORAGE, {
        useValue: {
            uploadToGCS,
            uploadToTemporaryFolder,
            getFromGCS,
            generateSignedUrl,
        },
    });

    // Register Media
    container.register(TOKENS.MEDIA, {
        useValue: {
            backendPixiService,
            getImageDimensions: nodeServices.getImageDimensions,
            getImageBuffer: nodeServices.getImageBuffer,
            resolveFileDataUrl: nodeServices.resolveFileDataUrl,
            bufferToDataUrl: nodeServices.bufferToDataUrl,
        },
    });

    // Register Graph Resolvers
    container.register(TOKENS.GRAPH_RESOLVERS, {
        useValue: {
            getInputValue: nodeServices.getInputValue,
            getInputValuesByType: nodeServices.getInputValuesByType,
            getAllOutputHandles: nodeServices.getAllOutputHandles,
            getAllInputValuesWithHandle: nodeServices.getAllInputValuesWithHandle,
            loadMediaBuffer: nodeServices.loadMediaBuffer,
            getFileDataMimeType: nodeServices.getFileDataMimeType,
        },
    });

    return container;
}
