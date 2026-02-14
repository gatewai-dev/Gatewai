/**
 * Dependency Injection Tokens for Gatewai Core.
 * Use these tokens to inject core services into your application.
 */
export const TOKENS = {
	PRISMA: Symbol.for("PRISMA"),
	ENV: Symbol.for("ENV"),
	STORAGE: Symbol.for("STORAGE"),
	MEDIA: Symbol.for("MEDIA"),
	GRAPH_RESOLVERS: Symbol.for("GRAPH_RESOLVERS"),
	AI_PROVIDER: Symbol.for("AI_PROVIDER"),
} as const;
