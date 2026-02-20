import { hc } from "hono/client";
import type { AppType } from "../../../apps/gatewai-backend/dist/src/index";

export const createRpcClient = (baseUrl: string = "/", init?: RequestInit) => {
	const { headers, ...restInit } = init || {};
	return hc<AppType>(baseUrl, {
		init: restInit,
		headers: headers as any,
	});
};
