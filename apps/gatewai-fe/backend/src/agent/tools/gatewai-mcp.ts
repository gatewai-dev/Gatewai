import { MCPServerStreamableHttp } from "@openai/agents";
import { ENV_CONFIG } from "../../config.js";
import { logger } from "../../logger.js";

logger.info(`Initializing MCP Tool with URL: ${ENV_CONFIG.MCP_URL}`);

// Create a logger adapter that implements the MCP Logger interface
const mcpLogger = {
	namespace: "mcp-server",
	debug: (message: string, ...args: unknown[]) => {
		logger.debug({ mcpArgs: args }, message);
	},
	error: (message: string, ...args: unknown[]) => {
		logger.error({ mcpArgs: args }, message);
	},
	warn: (message: string, ...args: unknown[]) => {
		logger.warn({ mcpArgs: args }, message);
	},
	dontLogModelData: false,
	dontLogToolData: false,
};

// function to create the tool with user context
export const createGatewaiMCPTool = (headers: Record<string, string> = {}) => {
	logger.info(
		{ headers: Object.keys(headers) },
		"Creating MCP Tool with headers",
	);

	// Create a new instance for this context
	return new MCPServerStreamableHttp({
		url: ENV_CONFIG.MCP_URL,
		name: "Gatewai MCP Streamable HTTP Server",
		clientSessionTimeoutSeconds: 300,
		timeout: 300000,
		logger: mcpLogger,
		requestInit: {
			headers: {
				...headers,
				"Content-Type": "application/json",
			},
		},
		reconnectionOptions: {
			maxRetries: 2,
			initialReconnectionDelay: 2000,
			reconnectionDelayGrowFactor: 2,
			maxReconnectionDelay: 30000,
		},
	});
};

// Deprecated static instance - retained for backward compat if needed,
// but we should migrate away from it.
// For now, initialized without headers (public/service mode if applicable, likely fails auth now)
export const localGatewaiMCPTool = createGatewaiMCPTool({});

// Helper to connect a specific tool instance
export const connectMCP = async (toolInstance: MCPServerStreamableHttp) => {
	try {
		logger.info("Connecting to MCP server...");
		await toolInstance.connect();
		logger.info("Successfully connected to MCP server");
	} catch (err) {
		logger.error({ err }, "Failed to connect to MCP tool");
		throw err;
	}
};
