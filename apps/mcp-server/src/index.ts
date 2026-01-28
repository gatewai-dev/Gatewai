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
 * Resource: List all Assets
 * URI: gatewai://assets
 */
server.registerResource(
	"asset-list",
	"gatewai://assets",
	{
		description: "List all available file assets (images, videos, audio)",
		mimeType: "application/json",
	},
	async (uri) => {
		try {
			const assets = await apiClient.listAssets({});
			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(assets, null, 2),
						mimeType: "application/json",
					},
				],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			throw new Error(`Failed to fetch assets: ${msg}`);
		}
	},
);

/**
 * Resource: Get Specific Asset Details
 * URI: gatewai://assets/{id}
 */
server.registerResource(
	"asset-detail",
	new ResourceTemplate("gatewai://assets/{id}", { list: undefined }),
	{
		description:
			"Get details of a specific asset including metadata, URL, and dimensions",
		mimeType: "application/json",
	},
	async (uri, { id }) => {
		try {
			const assetId = id as string;
			const asset = await apiClient.getAsset(assetId);

			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(asset, null, 2),
						mimeType: "application/json",
					},
				],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			throw new Error(`Failed to fetch asset ${id}: ${msg}`);
		}
	},
);

// ==================== CANVAS TOOLS ====================

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
		description: `Discover available input nodes (Text, File) in a canvas workflow.
		Should be used to retrieve input schema for run workflow.`,
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
					currentValue: {
						config: n.config ?? null,
						result: n.result ?? null,
					},
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
		try {
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
		} catch (error) {
			console.error(error);
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [{ type: "text", text: `Error proposing patch: ${msg}` }],
				isError: true,
			};
		}
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

/**
 * Tool: Upload Asset from Base64
 */
server.registerTool(
	"upload-asset",
	{
		description: "Upload a new file asset from base64 encoded data",
		inputSchema: z.object({
			filename: z.string().describe("Name of the file including extension"),
			base64Data: z
				.string()
				.describe("Base64 encoded file content (without data URI prefix)"),
			mimeType: z
				.string()
				.optional()
				.describe("MIME type of the file (e.g., 'image/png', 'video/mp4')"),
		}),
	},
	async ({ filename, base64Data, mimeType }) => {
		try {
			const result = await apiClient.uploadAsset({
				filename,
				base64Data,
				mimeType,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [{ type: "text", text: `Error uploading asset: ${msg}` }],
				isError: true,
			};
		}
	},
);

/**
 * Tool: Upload Asset from URL
 */
server.registerTool(
	"upload-asset-from-url",
	{
		description:
			"Upload a new file asset by downloading from a public URL on the internet",
		inputSchema: z.object({
			url: z.string().url().describe("Public URL of the file to download"),
			filename: z
				.string()
				.optional()
				.describe(
					"Optional custom filename. If not provided, will be extracted from URL",
				),
		}),
	},
	async ({ url, filename }) => {
		try {
			const result = await apiClient.uploadAssetFromUrl({
				url,
				filename,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [
					{ type: "text", text: `Error uploading asset from URL: ${msg}` },
				],
				isError: true,
			};
		}
	},
);

/**
 * Tool: Upload Asset to Node
 */
server.registerTool(
	"upload-asset-to-node",
	{
		description:
			"Upload a file asset directly to a specific node (Import Media node)",
		inputSchema: z.object({
			nodeId: z.string().describe("The ID of the node to upload the asset to"),
			filename: z.string().describe("Name of the file including extension"),
			base64Data: z
				.string()
				.describe("Base64 encoded file content (without data URI prefix)"),
			mimeType: z
				.string()
				.optional()
				.describe("MIME type of the file (e.g., 'image/png', 'video/mp4')"),
		}),
	},
	async ({ nodeId, filename, base64Data, mimeType }) => {
		try {
			const result = await apiClient.uploadAssetToNode({
				nodeId,
				filename,
				base64Data,
				mimeType,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [
					{ type: "text", text: `Error uploading asset to node: ${msg}` },
				],
				isError: true,
			};
		}
	},
);

/**
 * Tool: Delete Asset
 */
server.registerTool(
	"delete-asset",
	{
		description: "Delete a file asset permanently",
		inputSchema: z.object({
			assetId: z.string().describe("The ID of the asset to delete"),
		}),
	},
	async ({ assetId }) => {
		try {
			const result = await apiClient.deleteAsset(assetId);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [{ type: "text", text: `Error deleting asset: ${msg}` }],
				isError: true,
			};
		}
	},
);

/**
 * Tool: Get Asset Thumbnail
 */
server.registerTool(
	"get-asset-thumbnail",
	{
		description:
			"Get a thumbnail URL for an image or video asset with custom dimensions",
		inputSchema: z.object({
			assetId: z.string().describe("The ID of the asset"),
			width: z
				.number()
				.int()
				.positive()
				.optional()
				.describe("Thumbnail width in pixels (default: 300)"),
			height: z
				.number()
				.int()
				.positive()
				.optional()
				.describe("Thumbnail height in pixels (default: 300)"),
		}),
	},
	async ({ assetId, width, height }) => {
		try {
			const thumbnailUrl = apiClient.getAssetThumbnailUrl(
				assetId,
				width,
				height,
			);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ assetId, thumbnailUrl }, null, 2),
					},
				],
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error.";
			return {
				content: [
					{ type: "text", text: `Error generating thumbnail URL: ${msg}` },
				],
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
	console.log("MCP SSE request received");
	return transport.handleRequest(c);
});

// MCP POST Endpoint (for JSON-RPC messages)
app.post("/mcp", async (c) => {
	console.log("MCP POST request received");
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
