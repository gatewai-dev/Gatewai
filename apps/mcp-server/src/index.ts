import { GatewaiApiClient, type StartRunRequest } from "@gatewai/api-client";
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
});

const server = new McpServer({
	name: "gatewai-mcp-server",
	version: "0.0.1",
});

/**
 * Resource: List all Canvas Workflows
 * URI: gatewai://canvases
 */
server.registerResource(
	"canvas-list",
	"gatewai://canvases",
	{
		description: "List all available canvas workflows",
		mimeType: "application/json",
	},
	async (uri) => {
		try {
			const canvases = await apiClient.getCanvases();
			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(canvases, null, 2),
						mimeType: "application/json",
					},
				],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			throw new Error(`Failed to fetch canvases: ${msg}`);
		}
	},
);

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
		try {
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
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			throw new Error(`Failed to fetch node templates: ${msg}`);
		}
	},
);

/**
 * Tool: Create a new empty canvas
 */
server.registerTool(
	"create-canvas",
	{
		description: "Create a new empty canvas workflow",
		inputSchema: z.object({
			name: z.string().optional().describe("Optional name for the new canvas"),
		}),
	},
	async ({ name }) => {
		try {
			const newCanvas = await apiClient.createCanvas();

			// If a name was provided, update it with a second call
			if (name && newCanvas.id) {
				await apiClient.updateCanvasName(newCanvas.id, { name });
				// Fetch fresh state to return accurate data
				const updated = await apiClient.getCanvas(newCanvas.id);
				return {
					content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
				};
			}

			return {
				content: [{ type: "text", text: JSON.stringify(newCanvas, null, 2) }],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [{ type: "text", text: `Error creating canvas: ${msg}` }],
				isError: true,
			};
		}
	},
);

/**
 * Tool: Duplicate an existing canvas
 */
server.registerTool(
	"duplicate-canvas",
	{
		description: "Duplicate an existing canvas workflow",
		inputSchema: z.object({
			canvasId: z.string().describe("The ID of the canvas to duplicate"),
		}),
	},
	async ({ canvasId }) => {
		try {
			const result = await apiClient.duplicateCanvas(canvasId);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [{ type: "text", text: `Error duplicating canvas: ${msg}` }],
				isError: true,
			};
		}
	},
);

/**
 * Tool: Delete a canvas
 */
server.registerTool(
	"delete-canvas",
	{
		description: "Delete a canvas workflow permanently",
		inputSchema: z.object({
			canvasId: z.string().describe("The ID of the canvas to delete"),
		}),
	},
	async ({ canvasId }) => {
		try {
			const result = await apiClient.deleteCanvas(canvasId);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [{ type: "text", text: `Error deleting canvas: ${msg}` }],
				isError: true,
			};
		}
	},
);

/**
 * Tool: Run a Workflow
 */
server.registerTool(
	"run-workflow",
	{
		description: "Execute a workflow and wait for completion with polling",
		inputSchema: z.object({
			canvasId: z.string().describe("The ID of the canvas workflow to execute"),
			inputs: z
				.record(z.any())
				.optional()
				.describe(
					"Dictionary of input values for the workflow execution. Keys should be the Node IDs (from get-canvas-inputs) and values should be the string content (for Text nodes) or base64 string (for File nodes).",
				),
		}),
	},
	async ({ canvasId, inputs }) => {
		try {
			const payload: StartRunRequest = {
				canvasId,
				inputs: inputs || {},
			};
			const result = await apiClient.run(payload);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [{ type: "text", text: `Workflow execution failed: ${msg}` }],
				isError: true,
			};
		}
	},
);

/**
 * Tool: Get Canvas Inputs
 */
server.registerTool(
	"get-canvas-inputs",
	{
		description:
			"Discover available input nodes (Text, File) in a canvas workflow",
		inputSchema: z.object({
			canvasId: z.string().describe("The ID of the canvas to inspect"),
		}),
	},
	async ({ canvasId }) => {
		try {
			const canvasData = await apiClient.getCanvas(canvasId);

			const inputNodes = canvasData.nodes
				.filter((n) => n.type === "Text" || n.type === "File")
				.map((n) => ({
					id: n.id,
					name: n.name,
					type: n.type,
					currentValue: n.config?.content || "(no content)",
				}));

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								canvasId,
								inputs: inputNodes,
								instructions:
									"Use the 'id' of these nodes as keys in the 'inputs' dictionary for the 'run-workflow' tool.",
							},
							null,
							2,
						),
					},
				],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [
					{ type: "text", text: `Error fetching canvas inputs: ${msg}` },
				],
				isError: true,
			};
		}
	},
);

/**
 * Tool: Update Canvas Name
 */
server.registerTool(
	"rename-canvas",
	{
		description: "Update the name of a canvas workflow",
		inputSchema: z.object({
			canvasId: z.string().describe("The ID of the canvas to rename"),
			newName: z.string().describe("The new name for the canvas"),
		}),
	},
	async ({ canvasId, newName }) => {
		try {
			const result = await apiClient.updateCanvasName(canvasId, {
				name: newName,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [{ type: "text", text: `Error renaming canvas: ${msg}` }],
				isError: true,
			};
		}
	},
);

/**
 * Tool: Patch Canvas
 */
server.registerTool(
	"patch-canvas",
	{
		description: `Update the canvas workflow using a sync/upsert strategy.
		- For EXISTING nodes/edges/handles: You MUST include their current valid UUID 'id'.
		- For NEW nodes/edges/handles: You can provide a temporary ID (e.g. "temp-1", "node-new-A") or a random string.
		  The server will generate a valid UUID and replace your temporary ID.
		- LINKING NEW ELEMENTS: If you create a new Node with ID "temp-1" and a new Edge connecting to it, use ID "temp-1" in the Edge's source/target fields. 
		  The server will resolve these temporary references automatically.
		- DELETIONS: Any existing node/edge/handle NOT present in this payload will be DELETED. Ensure you fetch the latest state before patching.`,
		inputSchema: z.object({
			canvasId: z.string().describe("The ID of the canvas to update"),
			canvasState: bulkUpdateSchema.describe(
				"Full Canvas state. Use temporary IDs for new items.",
			),
		}),
	},
	async ({ canvasId, canvasState }) => {
		try {
			const result = await apiClient.updateCanvas(canvasId, canvasState);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [{ type: "text", text: `Error patching canvas: ${msg}` }],
				isError: true,
			};
		}
	},
);

const app = new Hono();
const transport = new StreamableHTTPTransport();

app.use("*", cors());
app.use("*", logger());

// Health Check
app.get("/health", (c) => c.json({ status: "ok", env: env.LOG_LEVEL }));

// MCP SSE Endpoint
app.get("/mcp", async (c) => {
	if (!server.isConnected()) {
		await server.connect(transport);
	}
	return transport.handleRequest(c);
});

// MCP POST Endpoint (for JSON-RPC messages)
app.post("/mcp", async (c) => {
	if (!server.isConnected()) {
		await server.connect(transport);
	}
	return transport.handleRequest(c);
});

console.log(
	`Gatewai MCP Server running on http://localhost:${env.MCP_PORT}/mcp`,
);

serve({
	fetch: app.fetch,
	port: env.MCP_PORT,
});
