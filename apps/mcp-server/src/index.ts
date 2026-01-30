import { GatewaiApiClient } from "@gatewai/api-client";
import { bulkUpdateSchema } from "@gatewai/types";
import { StreamableHTTPTransport } from "@hono/mcp";
import { serve } from "@hono/node-server";
import {
	McpServer,
	ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "dotenv";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";

config();

const EnvSchema = z.object({
	BASE_URL: z.string().url("BASE_URL must be a valid URL"),
	MCP_PORT: z.coerce.number().default(4001),
	LOG_LEVEL: z.enum(["debug", "info", "error"]).default("info"),
	GATEWAI_API_KEY: z.string(),
});

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
	console.error("Invalid Environment Variables:");
	console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
	process.exit(1);
}

const env = result.data;

const apiClient = new GatewaiApiClient({
	baseUrl: env.BASE_URL,
	apiKey: env.GATEWAI_API_KEY,
});

console.log(`MCP Server initialized with BASE_URL: ${env.BASE_URL}`);

const server = new McpServer({
	name: "gatewai-mcp-server",
	version: "0.0.1",
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
			const canvasId = id as string;
			const canvas = await apiClient.getCanvas(canvasId);

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
		const templates = await apiClient.getNodeTemplates();
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
		const result = await apiClient.createPatch(
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
			const result = await apiClient.listAssets({
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
app.use("*", async (c, next) => {
	// --- Log Request Body ---
	if (c.req.header("content-type")?.includes("application/json")) {
		const body = await c.req.raw.clone().json();
		console.log(`[REQ BODY]:`, JSON.stringify(body, null, 2));
	}

	await next();

	// --- Log Response Body ---
	// Note: We clone the response to avoid "body already used" errors
	const resClone = c.res.clone();
	const contentType = resClone.headers.get("content-type");

	if (contentType?.includes("application/json")) {
		const resBody = await resClone.json();
		console.log(`[RES BODY]:`, JSON.stringify(resBody, null, 2));
	} else if (contentType?.includes("text/")) {
		const resText = await resClone.text();
		console.log(`[RES TEXT]:`, resText);
	}
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
	console.log("--- AI ATTEMPTED TOOL CALL ---");
	console.log(rawBody);
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

console.log(`Gatewai MCP Server running on http://0.0.0.0:${env.MCP_PORT}/mcp`);
