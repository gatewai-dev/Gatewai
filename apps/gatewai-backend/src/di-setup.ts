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
	container.bind(TOKENS.PRISMA).toConstantValue(prisma);
	container.bind(TOKENS.ENV).toConstantValue(ENV_CONFIG);

	// Register Storage
	container.bind(TOKENS.STORAGE).toConstantValue(storageService);

	// Register Media
	container.bind(TOKENS.MEDIA).toConstantValue(mediaService);

	// Register Graph Resolvers
	container.bind(TOKENS.GRAPH_RESOLVERS).toConstantValue(graphResolvers);

	// Register AI Provider
	container.bind(TOKENS.AI_PROVIDER).toConstantValue({
		getGemini: () => {
			if (ENV_CONFIG.GEMINI_API_KEY == null)
				throw new Error("No Gemini API kep provided");
			return new GoogleGenAI({ apiKey: ENV_CONFIG.GEMINI_API_KEY });
		},
	});

	return container;
}
