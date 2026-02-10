import { hc } from "hono/client";
import type { AppType } from "../../../apps/gatewai-fe/backend/src/index";

export type { AppType };

export const createRpcClient = (baseUrl: string = "/") => {
	return hc<AppType>(baseUrl, {
		init: {
			credentials: "same-origin",
		},
	});
};
