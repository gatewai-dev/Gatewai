import { GatewaiApiClient } from "@gatewai/api-client";
import { bulkUpdateSchema } from "@gatewai/types";
import { StreamableHTTPTransport } from "@hono/mcp";
import { serve } from "@hono/node-server";
import {
	McpServer,
	ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import assert from "assert";
import { config } from "dotenv";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createRequire } from "module";
import { z } from "zod";
import { getApiClientSafe, runWithApiClient } from "./context.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

config();

const EnvSchema = z.object({
	BASE_URL: z.string().url("BASE_URL must be a valid URL"),
	MCP_PORT: z.coerce.number().default(4001),
	LOG_LEVEL: z.enum(["debug", "info", "error"]).default("info"),
	GATEWAI_API_KEY: z.string().optional(),
});

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
	console.error("Invalid Environment Variables:");
	console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
	process.exit(1);
}

const env = result.data;

console.log(`MCP Server initialized with BASE_URL: ${env.BASE_URL}`);

const server = new McpServer({
	name: pkg.name,
	version: pkg.version,
});

/**
 * Resource: Get Specific Canvas Details
 * URI: gatewai://canvases/{id}
 */
server.registerResource(
	"canvas-detail",
	new ResourceTemplate("gatewai://canvases/{id}", { list: undefined }),
	{
		description:
			"Get details of a specific canvas workflow including workflow nodes, edges and handles.",
		mimeType: "application/json",
	},
	async (uri, { id }) => {
		try {
			const client = getApiClientSafe();
			const canvasId = id as string;
			const canvas = await client.getCanvas(canvasId);

			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(canvas, null, 2),
						mimeType: "application/json",
					},
				],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			throw new Error(`Failed to fetch canvas ${id}: ${msg}`);
		}
	},
);

/**
 * Resource: Node Templates
 * URI: gatewai://node-templates
 */
server.registerResource(
	"node-templates",
	"gatewai://node-templates",
	{
		description: "Available node templates for canvas workflows",
		mimeType: "application/json",
	},
	async (uri) => {
		const client = getApiClientSafe();
		const templates = await client.getNodeTemplates();
		return {
			contents: [
				{
					uri: uri.href,
					text: JSON.stringify(templates, null, 2),
					mimeType: "application/json",
				},
			],
		};
	},
);

/**
 * Tool: Propose Canvas Update
 */
server.registerTool(
	"propose-canvas-update",
	{
		description: `Propose an update to the canvas workflow.
		- This will NOT apply changes immediately. The user will review them.
		- For EXISTING nodes/edges/handles: You MUST include their current valid UUID 'id'.
		- For NEW nodes/edges/handles: You can provide a temporary ID (e.g. "temp-1", "node-new-A") or a random string.
		  The server will generate a valid UUID and replace your temporary ID.
		- LINKING NEW ELEMENTS: If you create a new Node with ID "temp-1" and a new Edge connecting to it, use ID "temp-1" in the Edge's source/target fields. 
		  The server will resolve these temporary references automatically.
		- DELETIONS: Any existing node/edge/handle NOT present in this payload will be DELETED. Ensure you fetch the latest state before patching.`,
		inputSchema: z.object({
			canvasId: z.string().describe("The ID of the canvas to update"),
			agentSessionId: z
				.string()
				.optional()
				.describe("The ID of the current agent session"),
			canvasState: bulkUpdateSchema.describe(
				"Full Canvas state. Use temporary IDs for new items.",
			),
		}),
	},
	async ({ canvasId, canvasState, agentSessionId }) => {
		const client = getApiClientSafe();
		const result = await client.createPatch(
			canvasId,
			canvasState,
			agentSessionId,
		);
		return {
			content: [
				{
					type: "text",
					text: `Patch proposed successfully. Patch ID: ${result.id}. The user has been notified to review the changes.`,
				},
			],
		};
	},
);

//#region Assets
/**
 * Tool: List Assets with Filters
 */
server.registerTool(
	"list-assets",
	{
		description:
			"List file assets with optional filtering by type and search query",
		inputSchema: z.object({
			pageSize: z
				.number()
				.int()
				.positive()
				.max(1000)
				.optional()
				.describe("Number of items per page (max 1000)"),
			pageIndex: z
				.number()
				.int()
				.nonnegative()
				.optional()
				.describe("Page index (0-based)"),
			query: z.string().optional().describe("Search query for asset names"),
			type: z
				.enum(["image", "video", "audio"])
				.optional()
				.describe("Filter by asset type"),
		}),
	},
	async ({ pageSize, pageIndex, query, type }) => {
		try {
			const client = getApiClientSafe();
			const result = await client.listAssets({
				pageSize,
				pageIndex,
				q: query,
				type,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [{ type: "text", text: `Error listing assets: ${msg}` }],
				isError: true,
			};
		}
	},
);

const app = new Hono();
const transport = new StreamableHTTPTransport();

app.use("*", cors());
app.use("*", logger());

// Auth Context Middleware
app.use("*", async (c, next) => {
	// Extract headers
	const apiKey = c.req.header("x-api-key");
	const cookie = c.req.header("cookie");
	const authorization = c.req.header("authorization");

	// Create scoped client if any auth header is present
	let scopedClient: GatewaiApiClient | undefined;

	if (apiKey || cookie || authorization) {
		const headers: Record<string, string> = {};
		if (apiKey) headers["x-api-key"] = apiKey;
		if (cookie) headers["cookie"] = cookie;
		if (authorization) headers["authorization"] = authorization;
		assert(apiKey, "API key is required");
		scopedClient = new GatewaiApiClient({
			baseUrl: env.BASE_URL,
			apiKey: apiKey, // Use user API key if exists, else fallback to global for client init (but headers map is crucial)
			headers: headers, // Pass all captured headers including cookies
		});
	}
	assert(scopedClient, "Unauthorized");
	// Run next() within the context
	return runWithApiClient(scopedClient, async () => {
		return await next();
	});
});

// Health Check
app.get("/health", (c) => c.json({ status: "ok", env: env.LOG_LEVEL }));

// MCP SSE Endpoint
app.get("/mcp", async (c) => {
	return transport.handleRequest(c);
});

// MCP POST Endpoint (for JSON-RPC messages)
app.post("/mcp", async (c) => {
	const rawBody = await c.req.raw.clone().text();
	return transport.handleRequest(c);
});

// Connect the server to the transport once at startup
console.log("Connecting MCP server to transport...");
server.connect(transport).catch((err) => {
	console.error("Failed to connect MCP server to transport:", err);
});

serve({
	fetch: app.fetch,
	port: env.MCP_PORT,
	hostname: "0.0.0.0",
});

console.log(
	`Gatewai MCP Server version: (${pkg.version}) running on http://0.0.0.0:${env.MCP_PORT}/mcp`,
);
