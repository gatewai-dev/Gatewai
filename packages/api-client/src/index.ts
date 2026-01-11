import { z } from "zod";

export const RequestSchema = z.object({
	canvasId: z.string(),
	payload: z.record(z.string(), z.string()).optional(),
});

export type APIRequest = z.infer<typeof RequestSchema>;

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
	success: z.boolean().default(true),
	error: z.string().optional(),
});

export type APIResponse = z.infer<typeof ResponseSchema>;

export interface APIClientConfig {
	baseUrl: string;
	timeoutMs?: number;
}

/**
 * API Client
 */
export class GatewaiApiClient {
	private baseUrl: string;

	constructor(config: APIClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, "");
	}

	/**
	 * Internal fetch wrapper with validation
	 */
	private async request<T>(
		endpoint: string,
		options?: RequestInit,
	): Promise<T> {
		const response = await fetch(`${this.baseUrl}/api/v1/${endpoint}`, {
			...options,
			headers: {
				"Content-Type": "application/json",
				...options?.headers,
			},
		});

		if (!response.ok) {
			const errBody = await response.json().catch(() => ({}));
			throw new Error(
				errBody.error ||
					`HTTP Error: ${response.status} ${response.statusText}`,
			);
		}

		return (await response.json()) as T;
	}

	/**
	 * Starts a run on a canvas
	 */
	async startRun(request: APIRequest): Promise<APIResponse> {
		const validated = RequestSchema.parse(request);
		const data = await this.request<APIResponse>("api-run", {
			method: "POST",
			body: JSON.stringify(validated),
		});
		return ResponseSchema.parse(data);
	}

	/**
	 * Checks the status of a specific batch
	 */
	async checkStatus(batchHandleId: string): Promise<APIResponse> {
		const data = await this.request<APIResponse>(
			`api-run/${batchHandleId}/status`,
		);
		return ResponseSchema.parse(data);
	}

	/**
	 * Triggers a run and polls until completion.
	 */
	async run(
		request: APIRequest,
		pollingIntervalMs = 1000,
	): Promise<APIResponse> {
		let status = await this.startRun(request);

		while (!status.result && !status.error) {
			await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
			status = await this.checkStatus(status.batchHandleId);

			if (status.success === false) {
				break;
			}
		}

		return status;
	}
}
