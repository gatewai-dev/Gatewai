import { GatewaiApiClient } from "@gatewai/api-client";
// Specialized Hono transport
import { StreamableHTTPTransport } from "@hono/mcp";
import { serve } from "@hono/node-server";
import {
	McpServer,
	ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ListResourcesResult } from "@modelcontextprotocol/sdk/types.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

// 1. Create the MCP server
const server = new McpServer({
	name: "gatewai-mcp-server",
	version: "0.0.1",
});

const BASE_URL = process.env.BASE_URL;

if (!BASE_URL) {
	throw new Error("Missing Gatewai BASE_URL");
}

const apiClient = new GatewaiApiClient({
	baseUrl: BASE_URL,
});

const canvasListResourceTemplate = new ResourceTemplate("/canvas-list", {
	list: (ex) => {
		const result: ListResourcesResult = {};
	},
});
server.registerResource("Fetch Canvas Workflows", canvasListResourceTemplate, {
	description: "",
});

// 3. Initialize Hono and the Transport
const app = new Hono();
const transport = new StreamableHTTPTransport();

app.use("*", cors());

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// 4. MCP Route
// The @hono/mcp transport takes the Hono context (c) directly
app.all("/mcp", async (c) => {
	// Ensure server is connected to the transport
	if (!server.isConnected()) {
		await server.connect(transport);
	}
	return transport.handleRequest(c);
});

// 5. Start Server
const PORT = Number(process.env.MCP_PORT) || 3000;

console.log(`Hono MCP server running on http://localhost:${PORT}/mcp`);

serve({
	fetch: app.fetch,
	port: PORT,
});
