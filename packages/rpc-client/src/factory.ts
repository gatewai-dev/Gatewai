import { hc } from "hono/client";
import type { AppType } from "../../../apps/gatewai-backend/dist/src/index";

export const createRpcClient = (baseUrl: string = "/", init?: RequestInit) => {
	return hc<AppType>(baseUrl, {
		init,
	});
};
