import { GatewaiApiClient, type StartRunRequest } from "@gatewai/api-client";
import { StreamableHTTPTransport } from "@hono/mcp";
import { serve } from "@hono/node-server";
import {
	McpServer,
	ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

const EnvSchema = z.object({
	BASE_URL: z.string().url("BASE_URL must be a valid URL"),
	MCP_PORT: z.coerce.number().default(3000),
	LOG_LEVEL: z.enum(["debug", "info", "error"]).default("info"),
});

const env = EnvSchema.parse(process.env);

const apiClient = new GatewaiApiClient({
	baseUrl: env.BASE_URL,
});

const server = new McpServer({
	name: "gatewai-mcp-server",
	version: "1.0.0",
});

/**
 * Resource: List all Canvas Workflows
 * URI: gatewai://canvases
 */
server.resource("canvas-list", "gatewai://canvases", async (uri) => {
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
});

/**
 * Resource: Get Specific Canvas Details
 * URI: gatewai://canvases/{id}
 */
server.resource(
	"canvas-detail",
	new ResourceTemplate("gatewai://canvases/{id}", { list: undefined }),
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
server.resource("node-templates", "gatewai://node-templates", async (uri) => {
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
});

/**
 * Tool: Create a new empty canvas
 */
server.tool(
	"create-canvas",
	{
		name: z.string().optional().describe("Optional name for the new canvas"),
	},
	async ({ name }) => {
		try {
			const newCanvas = await apiClient.createCanvas();

			// If a name was provided, strictly speaking we need a second call to rename it
			// as the API `createCanvas` doesn't seem to accept a payload based on the client types.
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
server.tool(
	"duplicate-canvas",
	{
		canvasId: z.string().describe("The ID of the canvas to duplicate"),
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
server.tool(
	"delete-canvas",
	{
		canvasId: z.string().describe("The ID of the canvas to delete"),
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
 * Uses the client's polling mechanism to wait for completion.
 */
server.tool(
	"run-workflow",
	{
		canvasId: z.string().describe("The ID of the canvas to run"),
		inputs: z
			.record(z.any())
			.optional()
			.describe(
				"Dictionary of input values for the workflow execution. Keys should be the Node IDs (from get-canvas-inputs) and values should be the string content (for Text nodes) or base64 string (for File nodes).",
			),
	},
	async ({ canvasId, inputs }) => {
		try {
			// Construct the payload matching StartRunRequest
			const payload: StartRunRequest = {
				canvasId,
				inputs: inputs || {},
			};

			// Use the polling method to give the LLM the final result
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
 * Helper to discover available input nodes (Text, File) in a canvas.
 */
server.tool(
	"get-canvas-inputs",
	{
		canvasId: z.string().describe("The ID of the canvas to inspect"),
	},
	async ({ canvasId }) => {
		try {
			const canvasData = await apiClient.getCanvas(canvasId);

			// Filter for Text and File nodes which are typically inputs
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
server.tool(
	"rename-canvas",
	{
		canvasId: z.string(),
		newName: z.string(),
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

const app = new Hono();
const transport = new StreamableHTTPTransport();

// Middleware
app.use("*", cors());

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
