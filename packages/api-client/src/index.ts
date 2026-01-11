import { z } from "zod";

const API_CLIENT_CONFIG_SCHEMA = z.object({
	GATEWAI_URL: z.string().url(),
});

export type APIClientConfig = z.infer<typeof API_CLIENT_CONFIG_SCHEMA>;

export const RequestSchema = z.object({
	canvasId: z.string(),
	payload: z.record(z.string(), z.string()),
});

type APIRequest = z.infer<typeof RequestSchema>;

const ResultValueSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("Video"), data: z.string() }),
	z.object({ type: z.literal("Audio"), data: z.string() }),
	z.object({ type: z.literal("Text"), data: z.string() }),
	z.object({ type: z.literal("Image"), data: z.string() }),
	z.object({ type: z.literal("Number"), data: z.number() }),
	z.object({ type: z.literal("Boolean"), data: z.boolean() }),
]);

export const ResponseSchema = z.object({
	batchHandleId: z.string(),
	result: z.record(z.string(), ResultValueSchema).optional(),
	success: z.boolean().optional(),
	error: z.string().optional(),
});

export type APIResponse = z.infer<typeof ResponseSchema>;

export class GatewaiApiClient {
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
		const url = `${this.config.GATEWAI_URL.replace(/\/$/, "")}/v1/${endpoint}`;

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
		return this.fetchAndValidate("/api-run", {
			method: "POST",
			body: JSON.stringify(RequestSchema.parse(request)),
		});
	}

	/**
	 * Checks the status of an existing request.
	 * Developers should implemet their own polling mechanism with their own architecture.
	 */
	async checkStatus(batchHandleId: string): Promise<APIResponse> {
		return this.fetchAndValidate(`/api-run/${batchHandleId}`, {
			method: "GET",
		});
	}
}
