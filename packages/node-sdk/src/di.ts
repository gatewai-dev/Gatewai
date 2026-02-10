/**
 * Dependency Injection Tokens for Gatewai Node SDK.
 * Use these tokens to inject core services into your node processors.
 */
export const TOKENS = {
    PRISMA: Symbol.for("PRISMA"),
    ENV: Symbol.for("ENV"),
    STORAGE: Symbol.for("STORAGE"),
    MEDIA: Symbol.for("MEDIA"),
    NODE_SERVICES: Symbol.for("NODE_SERVICES"),
    GRAPH_RESOLVERS: Symbol.for("GRAPH_RESOLVERS"),
} as const;
