import { MCPServerStreamableHttp } from "@openai/agents";
import { ENV_CONFIG } from "../../config.js";

const localGatewaiMCPTool = new MCPServerStreamableHttp({
	url: ENV_CONFIG.MCP_URL,
	name: "Gatewai MCP Streamable HTTP Server",
	clientSessionTimeoutSeconds: 15,
	timeout: 15000,
	reconnectionOptions: {
		maxRetries: 2,
		initialReconnectionDelay: 2000,
		reconnectionDelayGrowFactor: 2,
		maxReconnectionDelay: 30000,
	},
});

export { localGatewaiMCPTool };
