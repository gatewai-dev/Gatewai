import { z } from "zod";

const API_CLIENT_CONFIG_SCHEMA = z.object({
	GATEWAI_URL: z.string().url(),
});

type APIClientConfig = z.infer<typeof API_CLIENT_CONFIG_SCHEMA>;

const RequestSchema = z.object({
	canvasId: z.string(),
	payload: z.record(z.string(), z.string()),
});

type APIRequest = z.infer<typeof RequestSchema>;

const ResponseSchema = z.object({
	batchHandleId: z.string(),
	result: z.record(z.string(), z.string()).optional(),
	success: z.boolean().optional(),
	error: z.string().optional(),
});

type APIResponse = z.infer<typeof ResponseSchema>;

export class ApiClient {
	private config: APIClientConfig;

	constructor(config: APIClientConfig) {
		this.config = API_CLIENT_CONFIG_SCHEMA.parse(config);
	}

	/**
	 * Shared fetch wrapper to handle JSON parsing and Zod validation
	 */
	private async fetchAndValidate(
		endpoint: string,
		options?: RequestInit,
	): Promise<APIResponse> {
		const url = `${this.config.GATEWAI_URL.replace(/\/$/, "")}${endpoint}`;

		const response = await fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				...options?.headers,
			},
		});

		if (!response.ok) {
			throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		// Validates that the server response matches the APIResponse schema
		return ResponseSchema.parse(data);
	}

	/**
	 * Initiates the request
	 */
	async makeRequest(request: APIRequest): Promise<APIResponse> {
		return this.fetchAndValidate("/requests", {
			method: "POST",
			body: JSON.stringify(RequestSchema.parse(request)),
		});
	}

	/**
	 * Checks the status of an existing request.
	 * Developers should implemet their own with their own architecture.
	 */
	async checkStatus(batchHandleId: string): Promise<APIResponse> {
		return this.fetchAndValidate(`/requests/${batchHandleId}`, {
			method: "GET",
		});
	}
}
