import { vi } from "vitest";

process.env.BASE_URL = "http://localhost:3000";
process.env.REDIS_HOST = "localhost";
process.env.REDIS_PORT = "6379";
process.env.GEMINI_API_KEY = "mock-key";
process.env.GCS_ASSETS_BUCKET = "mock-bucket";
process.env.GOOGLE_CLIENT_ID = "mock-id";
process.env.GOOGLE_CLIENT_SECRET = "mock-secret";
process.env.MCP_URL = "http://localhost:8080";

// Mock workflowQueue to avoid Redis connection attempts during tests
vi.mock("./queue/workflow.queue.js", () => ({
	workflowQueue: {
		add: vi.fn(),
	},
}));
