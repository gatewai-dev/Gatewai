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

const localGatewaiMCPTool = new MCPServerStreamableHttp({
	url: ENV_CONFIG.MCP_URL,
	name: "Gatewai MCP Streamable HTTP Server",
	clientSessionTimeoutSeconds: 300,
	timeout: 300000,
	logger: mcpLogger,
	reconnectionOptions: {
		maxRetries: 2,
		initialReconnectionDelay: 2000,
		reconnectionDelayGrowFactor: 2,
		maxReconnectionDelay: 30000,
	},
});

let isConnecting = false;
let isConnected = false;

export const connectMCP = async () => {
	if (isConnected) return;
	if (isConnecting) {
		// Wait for existing connection attempt
		while (isConnecting) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		return;
	}

	isConnecting = true;
	try {
		logger.info("Connecting to MCP server...");
		await localGatewaiMCPTool.connect();
		isConnected = true;
		logger.info("Successfully connected to MCP server");
	} catch (err) {
		logger.error({ err }, "Failed to connect to MCP tool");
		// Don't set isConnected to true, so we can retry later
	} finally {
		isConnecting = false;
	}
};

export { localGatewaiMCPTool };
