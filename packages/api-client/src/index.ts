import type { InferRequestType, InferResponseType } from "hono/client";
import { hc } from "hono/client";
// Ehm, we can pass it.
import type { AppType } from "../../../apps/gatewai-fe/backend/src/index";

const client = hc<AppType>("");
// Extracting Request Type for POST /api/v1/api-run
type StartRunRequest = InferRequestType<
	(typeof client.api.v1)["api-run"]["$post"]
>;
export type APIRequest = StartRunRequest["json"];

// Extracting Response Type for POST /api/v1/api-run
export type APIResponse = InferResponseType<
	(typeof client.api.v1)["api-run"]["$post"]
>;

export interface APIClientConfig {
	baseUrl: string;
	timeoutMs?: number;
}

export class GatewaiApiClient {
	private baseUrl: string;
	private rpc: ReturnType<typeof hc<AppType>>;

	constructor(config: APIClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, "");
		this.rpc = hc<AppType>(this.baseUrl);
	}

	/**
	 * Starts a run on a canvas
	 */
	async startRun(request: APIRequest): Promise<APIResponse> {
		const res = await this.rpc.api.v1["api-run"].$post({
			json: request,
		});

		if (!res.ok) {
			const errBody = await res.json().catch(() => ({}));
			throw new Error(errBody.error || `HTTP Error: ${res.status}`);
		}

		return (await res.json()) as APIResponse;
	}

	/**
	 * Checks the status of a specific batch
	 */
	async checkStatus(batchHandleId: string): Promise<APIResponse> {
		const res = await this.rpc.api.v1["api-run"][":batchHandleId"].status.$get({
			param: { batchHandleId },
		});

		if (!res.ok) {
			const errBody = await res.json().catch(() => ({}));
			throw new Error((errBody as any).error || `HTTP Error: ${res.status}`);
		}

		return (await res.json()) as APIResponse;
	}

	/**
	 * Triggers a run and polls until completion.
	 */
	async run(
		request: APIRequest,
		pollingIntervalMs = 1000,
	): Promise<APIResponse> {
		let status = await this.startRun(request);

		// Uses the inferred properties from your backend response
		while (!status.success && !status.error) {
			await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
			status = await this.checkStatus(status.batchHandleId);

			if (status.success === false) {
				break;
			}
		}

		return status;
	}
}
