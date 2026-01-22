import { MCPToolset } from "@google/adk";
import { ENV_CONFIG } from "../../config.js";

const localGatewaiMCPTool = new MCPToolset({
	url: ENV_CONFIG.MCP_URL,
	type: "StreamableHTTPConnectionParams",
});

export { localGatewaiMCPTool };
