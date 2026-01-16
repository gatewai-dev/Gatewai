import type { InferRequestType, InferResponseType } from "hono/client";
import { hc } from "hono/client";
import type { AppType } from "../../../apps/gatewai-fe/backend/src/index";

// We create a dummy client instance purely to extract types via Hono's Infer utility.
// This ensures your client types automatically stay in sync with your Zod schemas.
const client = hc<AppType>("");

// 1. API Run Types
type ApiRunRoute = (typeof client.api.v1)["api-run"];
export type StartRunRequest = InferRequestType<ApiRunRoute["$post"]>["json"];
export type StartRunResponse = InferResponseType<ApiRunRoute["$post"]>;
export type RunStatusResponse = InferResponseType<
	ApiRunRoute[":batchId"]["status"]["$get"]
>;

// 2. Canvas Types
type CanvasRoute = typeof client.api.v1.canvas;

export type CreateCanvasResponse = InferResponseType<CanvasRoute["$post"]>;
export type GetCanvasesResponse = InferResponseType<CanvasRoute["$get"]>;
export type GetCanvasResponse = InferResponseType<CanvasRoute[":id"]["$get"]>;

export type UpdateCanvasNameRequest = InferRequestType<
	CanvasRoute[":id"]["update-name"]["$patch"]
>["json"];
export type UpdateCanvasNameResponse = InferResponseType<
	CanvasRoute[":id"]["update-name"]["$patch"]
>;

export type BulkUpdateCanvasRequest = InferRequestType<
	CanvasRoute[":id"]["$patch"]
>["json"];
export type BulkUpdateCanvasResponse = InferResponseType<
	CanvasRoute[":id"]["$patch"]
>;

export type DuplicateCanvasResponse = InferResponseType<
	CanvasRoute[":id"]["duplicate"]["$post"]
>;

export type ProcessCanvasRequest = InferRequestType<
	CanvasRoute[":id"]["process"]["$post"]
>["json"];
export type ProcessCanvasResponse = InferResponseType<
	CanvasRoute[":id"]["process"]["$post"]
>;

// 3. Node Template Types
type NodeTemplatesRoute = (typeof client.api.v1)["node-templates"];
export type GetNodeTemplatesResponse = InferResponseType<
	NodeTemplatesRoute["$get"]
>;

export interface APIClientConfig {
	baseUrl: string;
	timeoutMs?: number;
	headers?: Record<string, string>;
}

export class GatewaiApiClient {
	private baseUrl: string;
	private rpc: ReturnType<typeof hc<AppType>>;

	constructor(config: APIClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, "");
		this.rpc = hc<AppType>(this.baseUrl, {
			headers: config.headers,
		});
	}

	// --------------------------------------------------------------------------
	// Helper: Generic Error Handler
	// --------------------------------------------------------------------------
	private async handleResponse<T>(res: Response): Promise<T> {
		if (!res.ok) {
			const errBody = await res.json().catch(() => ({}));
			// Prioritize returning the specific error message from the backend
			const msg =
				(errBody as { error?: string; message?: string }).error ||
				(errBody as { error?: string; message?: string }).message ||
				`HTTP Error: ${res.status}`;
			throw new Error(msg);
		}
		return (await res.json()) as T;
	}

	// --------------------------------------------------------------------------
	// Domain: Node Templates
	// --------------------------------------------------------------------------

	/**
	 * Fetches all available node templates.
	 */
	async getNodeTemplates(): Promise<GetNodeTemplatesResponse> {
		const res = await this.rpc.api.v1["node-templates"].$get();
		return this.handleResponse(res);
	}

	// --------------------------------------------------------------------------
	// Domain: Canvas Management
	// --------------------------------------------------------------------------

	/**
	 * Lists all non-API canvases, ordered by updated date.
	 */
	async getCanvases(): Promise<GetCanvasesResponse> {
		const res = await this.rpc.api.v1.canvas.$get();
		return this.handleResponse(res);
	}

	/**
	 * Creates a new empty canvas.
	 */
	async createCanvas(): Promise<CreateCanvasResponse> {
		const res = await this.rpc.api.v1.canvas.$post();
		return this.handleResponse(res);
	}

	/**
	 * Fetches a specific canvas including nodes, edges, and handles.
	 */
	async getCanvas(id: string): Promise<GetCanvasResponse> {
		const res = await this.rpc.api.v1.canvas[":id"].$get({
			param: { id },
		});
		return this.handleResponse(res);
	}

	/**
	 * Updates just the name of a canvas.
	 */
	async updateCanvasName(
		id: string,
		payload: UpdateCanvasNameRequest,
	): Promise<UpdateCanvasNameResponse> {
		const res = await this.rpc.api.v1.canvas[":id"]["update-name"].$patch({
			param: { id },
			json: payload,
		});
		return this.handleResponse(res);
	}

	/**
	 * Bulk updates a canvas (nodes, edges, handles).
	 * This handles creation, updating, and deletion based on the payload.
	 */
	async updateCanvas(
		id: string,
		payload: BulkUpdateCanvasRequest,
	): Promise<BulkUpdateCanvasResponse> {
		const res = await this.rpc.api.v1.canvas[":id"].$patch({
			param: { id },
			json: payload,
		});
		return this.handleResponse(res);
	}

	/**
	 * Deletes a canvas.
	 */
	async deleteCanvas(id: string): Promise<{ success: boolean }> {
		const res = await this.rpc.api.v1.canvas[":id"].$delete({
			param: { id },
		});
		return this.handleResponse(res);
	}

	/**
	 * Duplicates a canvas and all its entities.
	 */
	async duplicateCanvas(id: string): Promise<DuplicateCanvasResponse> {
		const res = await this.rpc.api.v1.canvas[":id"].duplicate.$post({
			param: { id },
		});
		return this.handleResponse(res);
	}

	/**
	 * Triggers the workflow processor for specific nodes in a canvas.
	 */
	async processCanvas(
		id: string,
		payload: ProcessCanvasRequest,
	): Promise<ProcessCanvasResponse> {
		const res = await this.rpc.api.v1.canvas[":id"].process.$post({
			param: { id },
			json: payload,
		});
		return this.handleResponse(res);
	}

	// --------------------------------------------------------------------------
	// Domain: API Run (Execution)
	// --------------------------------------------------------------------------

	/**
	 * Starts a new run (execution) on a canvas.
	 */
	async startRun(payload: StartRunRequest): Promise<StartRunResponse> {
		const res = await this.rpc.api.v1["api-run"].$post({
			json: payload,
		});
		return this.handleResponse(res);
	}

	/**
	 * Checks the status of a specific execution batch.
	 */
	async checkStatus(batchHandleId: string): Promise<RunStatusResponse> {
		const res = await this.rpc.api.v1["api-run"][":batchId"].status.$get({
			param: { batchId: batchHandleId },
		});
		return this.handleResponse(res);
	}

	/**
	 * Convenience method: Triggers a run and polls until completion.
	 */
	async run(
		request: StartRunRequest,
		pollingIntervalMs = 1000,
	): Promise<StartRunResponse | RunStatusResponse> {
		let status: StartRunResponse | RunStatusResponse =
			await this.startRun(request);

		// If immediate failure or immediate success (though startRun usually returns pending)
		if (!status.success && status.error) {
			return status;
		}

		while (true) {
			await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));

			// We cast here because checkStatus returns a slightly different shape
			// (includes 'result') but shares the base success/error structure.
			const nextStatus = await this.checkStatus(status.batchHandleId);

			// If we have a result (finished) or explicit failure
			if (nextStatus.result || nextStatus.success === false) {
				return nextStatus;
			}

			// Update status for the next loop (mainly for the handle ID)
			status = nextStatus;
		}
	}
}
