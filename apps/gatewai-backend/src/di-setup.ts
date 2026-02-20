import { ENV_CONFIG } from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import { prisma } from "@gatewai/db";
import {
	graphResolvers,
	mediaService,
	storageService,
} from "@gatewai/graph-engine";
import { GoogleGenAI } from "@google/genai";

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

	// Register AI Provider
	container.register(TOKENS.AI_PROVIDER, {
		useValue: {
			getGemini: () => new GoogleGenAI({ apiKey: ENV_CONFIG.GEMINI_API_KEY }),
		},
	});

	return container;
}
